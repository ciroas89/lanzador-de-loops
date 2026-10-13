/* Prueba del motor con golpes de tambor simulados.
   Uso: node afinador/prueba.js
   Cada golpe es una suma de modos de vibración de una membrana (con caída, subida de tono al golpear fuerte,
   chasquido del palo y ruido del lugar). Se mide qué tan cerca queda la lectura de la frecuencia real. */
const { analizar, Detector } = require('./analisis.js');

let semilla = 7;
const rnd = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

// Relación de los modos de un parche real (con la carga del aire, más juntos que en una membrana ideal)
const MODOS = [1, 1.50, 1.98, 2.44, 2.53, 2.88, 3.36];
const FS = 48000;

/* f: frecuencia del modo que se quiere medir; modo: índice del modo dominante.
   fuerza: 0..1 (más fuerte = más subida de tono al inicio). */
function golpe({ f0, dominante, fuerza, ruido = 0.0015, dur = 1.2, antes = 0.5, otroParche = 0 }) {
  const n = Math.round((antes + dur) * FS), x = new Float32Array(n), ini = Math.round(antes * FS);
  for (let i = 0; i < n; i++) x[i] = ruido * gauss();
  MODOS.forEach((r, m) => {
    const amp = (m === dominante ? 1 : 0.15 + 0.45 * rnd()) * (0.3 + 0.7 * fuerza);
    const caida = (m === 0 ? 0.35 : 0.25 / Math.sqrt(r)) * (0.7 + 0.6 * rnd());
    const glide = 0.012 * fuerza * fuerza;  // hasta 1,2 % más agudo al instante del golpe
    let fase = rnd() * 6.28;
    for (let i = ini; i < n; i++) {
      const t = (i - ini) / FS, fi = f0 * r * (1 + glide * Math.exp(-t / 0.04));
      fase += 2 * Math.PI * fi / FS;
      x[i] += 0.5 * amp * Math.exp(-t / caida) * Math.sin(fase);
    }
  });
  if (otroParche) {  // el otro parche sin apagar, en otra frecuencia
    let fase = 0;
    for (let i = ini; i < n; i++) { fase += 2 * Math.PI * f0 * 1.13 / FS; x[i] += otroParche * Math.exp(-(i - ini) / FS / 0.4) * Math.sin(fase); }
  }
  for (let i = ini; i < ini + 0.004 * FS; i++) x[i] += 0.6 * fuerza * gauss();  // chasquido
  return x;
}

function medir(x, op) {
  const d = new Detector(FS, { sensibilidad: 0.5, captura: op.captura || 0.5 });
  const res = [];
  for (let i = 0; i < x.length; i += 128) for (const g of d.push(x.subarray(i, i + 128))) res.push(analizar(g.muestras, FS, op));
  return res;
}

function resumen(nombre, errores, fallos, total) {
  const abs = errores.map(Math.abs).sort((a, b) => a - b);
  const p = q => abs.length ? abs[Math.min(abs.length - 1, Math.floor(q * abs.length))].toFixed(2) : '-';
  console.log(`${nombre.padEnd(46)} mediana ${p(0.5)} Hz · 95 % ${p(0.95)} Hz · máx ${p(1)} Hz · sin lectura ${fallos}/${total}`);
  return abs;
}

let ok = true;

// 1) Precisión por tambor. En uso real la primera lectura guía a las demás (los tensores difieren pocos %),
//    así que se pasa una guía desviada hasta ±4 % del valor real. Aparte se cuenta, sin guía,
//    cuántas veces el primer golpe toma el modo dominante.
for (const [nombre, f0, dom, fmin, fmax] of [
  ['Redoblante (tensor)', 230, 1, 150, 700],
  ['Tom 10" (tensor)', 150, 1, 70, 450],
  ['Tom 14" (tensor)', 95, 1, 50, 300],
  ['Bombo 22" (tensor)', 55, 1, 35, 160],
  ['Tom 12" (centro, fundamental)', 120, 0, 60, 400],
]) {
  const err = []; let fallos = 0, primeroBien = 0;
  for (let i = 0; i < 40; i++) {
    const f = f0 * (0.9 + 0.2 * rnd()), fuerza = 0.2 + 0.8 * rnd(), real = f * MODOS[dom];
    const x = golpe({ f0: f, dominante: dom, fuerza });
    const op = { fmin, fmax, modo: dom ? 'tensor' : 'centro', captura: f0 < 70 ? 0.8 : 0.5 };
    const sin = medir(x, op)[0];
    if (sin && !sin.error && Math.abs(sin.f / real - 1) < 0.03) primeroBien++;
    const r = medir(x, { ...op, guia: dom ? real * (1 + 0.08 * (rnd() - 0.5)) : null });
    if (!r.length || r[0].error) { fallos++; continue; }
    err.push(r[0].f - real);
  }
  const abs = resumen(nombre, err, fallos, 40);
  console.log(`${''.padEnd(46)} primer golpe sin guía en el modo fuerte: ${primeroBien}/40`);
  if (fallos > 2 || abs[Math.floor(abs.length * 0.95)] > 1) ok = false;
}

// 2) Igualar tensores: dos golpes con 1 Hz de diferencia y fuerza distinta. ¿Se ve la diferencia?
{
  const err = []; let fallos = 0;
  for (let i = 0; i < 40; i++) {
    const f = 140 + 60 * rnd(), dif = 1;
    const op = { fmin: 70, fmax: 500, modo: 'tensor' };
    const a = medir(golpe({ f0: f, dominante: 1, fuerza: 0.4 + 0.2 * rnd() }), op)[0];
    const b = medir(golpe({ f0: (f + dif / MODOS[1]), dominante: 1, fuerza: 0.4 + 0.2 * rnd() }), { ...op, guia: a && a.f })[0];
    if (!a || !b || a.error || b.error) { fallos++; continue; }
    // La diferencia esperada es 1 Hz en el modo dominante; si el golpe tomó otro modo, es proporcional
    const fb = f + dif / MODOS[1];
    err.push(b.f - a.f * fb / f);
  }
  const abs = resumen('Diferencia de 1 Hz entre tensores (error)', err, fallos, 40);
  if (abs[Math.floor(abs.length * 0.95)] > 0.5) ok = false;
}

// 3) Con el otro parche sin apagar y modos casi iguales en fuerza, la guía mantiene el mismo modo
{
  let saltos = 0;
  for (let i = 0; i < 40; i++) {
    const f = 160, op = { fmin: 70, fmax: 500, modo: 'tensor', guia: f * MODOS[1] };
    const r = medir(golpe({ f0: f + gauss() * 0.5, dominante: 1, fuerza: 0.5, otroParche: 0.25 }), op)[0];
    if (!r || r.error || Math.abs(r.f / op.guia - 1) > 0.03) saltos++;
  }
  console.log(`${'Otro parche sonando, sigue el mismo modo'.padEnd(46)} saltos de modo ${saltos}/40`);
  if (saltos > 4) ok = false;
}

// 4) Detector: no inventa golpes con ruido de fondo, y cuenta golpes seguidos
{
  const ruido = new Float32Array(FS * 5).map(() => 0.01 * gauss());
  const falsos = medir(ruido, { fmin: 70, fmax: 500, modo: 'tensor' }).length;
  const seguidos = [];
  for (let i = 0; i < 5; i++) seguidos.push(...golpe({ f0: 150, dominante: 1, fuerza: 0.5, dur: 0.9, antes: i ? 0.1 : 0.5 }));
  const n = medir(Float32Array.from(seguidos), { fmin: 70, fmax: 500, modo: 'tensor' }).length;
  console.log(`${'Detector'.padEnd(46)} golpes falsos con ruido ${falsos} · golpes contados ${n}/5`);
  if (falsos || n !== 5) ok = false;
}

console.log(ok ? '\nTodo bien' : '\nFALLÓ alguna prueba');
process.exit(ok ? 0 : 1);
