/* Motor del afinador: detecta golpes en el audio del micrófono y mide la frecuencia del parche.
   Sin dependencias del navegador para poder probarlo en Node (ver prueba.js). */
(function (raiz) {
  'use strict';

  // ---------- FFT (radix 2, compleja, en sitio) ----------
  const tablas = new Map();
  function tabla(n) {
    let t = tablas.get(n);
    if (!t) {
      const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
      for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = -Math.sin(2 * Math.PI * i / n); }
      const rev = new Uint32Array(n), bits = Math.log2(n);
      for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
      t = { cos, sin, rev };
      tablas.set(n, t);
    }
    return t;
  }
  function fft(re, im) {
    const n = re.length, { cos, sin, rev } = tabla(n);
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let tam = 2; tam <= n; tam <<= 1) {
      const mitad = tam >> 1, paso = n / tam;
      for (let i = 0; i < n; i += tam) {
        for (let j = 0, k = 0; j < mitad; j++, k += paso) {
          const a = i + j, b = a + mitad;
          const tr = re[b] * cos[k] - im[b] * sin[k], ti = re[b] * sin[k] + im[b] * cos[k];
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  }

  // ---------- Análisis de un golpe ----------
  /* x: muestras desde poco después del golpe. fs: frecuencia de muestreo.
     op.fmin / op.fmax: rango de búsqueda en Hz.
     op.modo: 'tensor' (golpe cerca del borde) o 'centro' (nota fundamental).
     op.guia: Hz esperados (las lecturas anteriores del mismo parche) para seguir siempre el mismo modo de vibración. */
  function analizar(x, fs, op) {
    const len = x.length;
    let n = 1; while (n < len * 4) n <<= 1;
    n = Math.min(Math.max(n, 1 << 15), 1 << 18);
    const re = new Float64Array(n), im = new Float64Array(n);
    let media = 0; for (let i = 0; i < len; i++) media += x[i]; media /= len;
    for (let i = 0; i < len; i++) re[i] = (x[i] - media) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (len - 1)));
    fft(re, im);
    const df = fs / n;
    const k0 = Math.max(2, Math.floor(op.fmin / df)), k1 = Math.min(n / 2 - 2, Math.ceil(op.fmax / df));
    const db = new Float64Array(k1 - k0 + 3);
    for (let k = k0 - 1; k <= k1 + 1; k++) db[k - k0 + 1] = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-30);
    const D = k => db[k - k0 + 1];

    // Picos: máximos locales dentro de un ancho parecido al lóbulo principal de la ventana
    const w = Math.max(2, Math.round(1.5 * n / len));
    const picos = [];
    for (let k = k0; k <= k1; k++) {
      const v = D(k);
      if (v < D(k - 1) || v < D(k + 1)) continue;
      let max = true;
      for (let j = Math.max(k0, k - w); j <= Math.min(k1, k + w) && max; j++) if (D(j) > v) max = false;
      if (!max) continue;
      const a = D(k - 1), c = D(k + 1), den = a - 2 * v + c;
      const d = den < 0 ? 0.5 * (a - c) / den : 0;
      picos.push({ f: (k + d) * df, db: v - 0.25 * (a - c) * d });
    }
    const orden = Array.from(db.subarray(1, db.length - 1)).sort((a, b) => a - b);
    const fondo = orden[Math.floor(orden.length / 2)];
    if (!picos.length) return { error: 'sin-pico', picos, fondo };
    picos.sort((a, b) => b.db - a.db);
    const top = picos[0].db;
    const fuertes = picos.filter(p => p.db > top - 20).slice(0, 8);

    let elegido = fuertes[0];
    if (op.modo === 'centro') {
      // La fundamental es el pico más grave con buena fuerza
      for (const p of fuertes) if (p.db > top - 10 && p.f < elegido.f) elegido = p;
    } else if (op.guia) {
      let mejor = null;
      for (const p of fuertes) {
        const dist = Math.abs(p.f / op.guia - 1);
        if (dist < 0.1 && p.db > top - 15 && (!mejor || dist < Math.abs(mejor.f / op.guia - 1))) mejor = p;
      }
      if (mejor) elegido = mejor;
    }
    const claridad = elegido.db - fondo;
    // Espectro resumido para dibujar: 400 puntos en escala logarítmica, el máximo de cada tramo
    const M = 400, esp = new Float32Array(M), razon = op.fmax / op.fmin;
    for (let j = 0; j < M; j++) {
      const a = Math.max(k0, Math.round(op.fmin * razon ** (j / M) / df)), b = Math.min(k1, Math.max(a, Math.round(op.fmin * razon ** ((j + 1) / M) / df)));
      let m = -Infinity; for (let k = a; k <= b; k++) m = Math.max(m, D(k));
      esp[j] = m;
    }
    return { f: elegido.f, claridad, picos: fuertes, fondo, tope: top, espectro: esp, error: claridad < 15 ? 'poco-claro' : null };
  }

  // ---------- Detección de golpes en el flujo del micrófono ----------
  /* Recibe bloques de audio con push() y devuelve los golpes listos para analizar.
     Un golpe es una subida brusca de volumen por encima del ruido del lugar. */
  class Detector {
    constructor(fs, op = {}) {
      this.fs = fs;
      this.salto = Math.round((op.salto ?? 0.02) * fs);      // se ignora el chasquido del palo
      this.largo = Math.round((op.captura ?? 0.5) * fs);
      this.sensib = op.sensibilidad ?? 0.5;                    // 0 a 1
      this.hop = 256;
      this.buf = new Float32Array(1 << 17);                    // ~2,7 s a 48 kHz
      this.escrito = 0;                                        // muestras recibidas en total
      this.leido = 0;                                          // hasta dónde se revisó volumen
      this.piso = 0;                                           // ruido del lugar (RMS)
      this.hist = [];                                          // energía de los bloques anteriores
      this.golpe = -1;                                         // muestra donde empezó el golpe en captura
      this.ultimo = -Infinity;
      this.techo = 0;
      this.nivel = 0;
    }
    set sensibilidad(v) { this.sensib = v; }
    set captura(s) { this.largo = Math.round(s * this.fs); }
    umbral() {
      // Más sensibilidad = umbral más bajo sobre el ruido del lugar
      const factor = 10 ** ((18 - 14 * this.sensib) / 20);
      const minimo = 10 ** ((-34 - 24 * this.sensib) / 20);
      return Math.max(this.piso * factor, minimo);
    }
    push(bloque) {
      const N = this.buf.length, salida = [];
      for (let i = 0; i < bloque.length; i++) this.buf[(this.escrito + i) % N] = bloque[i];
      this.escrito += bloque.length;
      while (this.leido + this.hop <= this.escrito) {
        let s = 0;
        for (let i = 0; i < this.hop; i++) { const v = this.buf[(this.leido + i) % N]; s += v * v; }
        // Volumen en ventanas de 4 bloques (~21 ms) para que un bombo de 40 Hz no parezca subir y bajar
        const h = this.hist; h.unshift(s / this.hop); if (h.length > 8) h.pop();
        const rms = Math.sqrt((h[0] + (h[1] || 0) + (h[2] || 0) + (h[3] || 0)) / Math.min(4, h.length));
        const antes = h.length === 8 ? Math.sqrt((h[4] + h[5] + h[6] + h[7]) / 4) : Infinity;
        this.nivel = rms;
        // Techo: volumen reciente que baja a la mitad cada ~400 ms. Las pulsaciones de un parche que
        // sigue sonando no llegan a él; un golpe nuevo sí.
        const techo = this.techo;
        this.techo = Math.max(rms, techo * 0.991);
        const listo = this.leido > 0.3 * this.fs;  // primero aprende el ruido del lugar
        const sube = listo && rms > this.umbral() && rms > antes * 2.5 && rms > techo * 0.6 && this.leido - this.ultimo > 0.12 * this.fs;
        if (sube) {
          // Inicio fino: primera muestra de los últimos 4 bloques que pasa la mitad del máximo
          const desde = Math.max(0, this.leido - 3 * this.hop), hasta = this.leido + this.hop;
          let max = 0;
          for (let i = desde; i < hasta; i++) max = Math.max(max, Math.abs(this.buf[i % N]));
          let ini = desde;
          for (let i = desde; i < hasta; i++) if (Math.abs(this.buf[i % N]) > max / 2) { ini = i; break; }
          this.golpe = ini;  // un golpe nuevo durante la captura reemplaza al anterior
          this.ultimo = this.leido;
        } else if (this.golpe < 0 && this.leido - this.ultimo > 0.12 * this.fs) {
          // Ruido del lugar: sigue rápido hacia abajo y lento hacia arriba
          if (!this.piso) this.piso = rms;
          else this.piso = rms < this.piso ? this.piso * 0.8 + rms * 0.2 : this.piso * 0.995 + rms * 0.005;
        }
        this.leido += this.hop;
      }
      if (this.golpe >= 0 && this.escrito >= this.golpe + this.salto + this.largo) {
        const ini = this.golpe + this.salto, seg = new Float32Array(this.largo);
        let pico = 0;
        for (let i = 0; i < this.largo; i++) { const v = this.buf[(ini + i) % N]; seg[i] = v; pico = Math.max(pico, Math.abs(v)); }
        for (let i = this.golpe; i < ini; i++) pico = Math.max(pico, Math.abs(this.buf[i % N]));
        salida.push({ muestras: seg, pico, inicio: this.golpe });
        this.golpe = -1;
      }
      return salida;
    }
  }

  // ---------- Notas ----------
  const NOMBRES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  function nota(f, la = 440) {
    const m = 69 + 12 * Math.log2(f / la), r = Math.round(m);
    return { nombre: NOMBRES[((r % 12) + 12) % 12], octava: Math.floor(r / 12) - 1, cents: Math.round((m - r) * 100), midi: r };
  }
  const INTERVALOS = ['unísono', 'segunda menor', 'segunda mayor', 'tercera menor', 'tercera mayor', 'cuarta', 'tritono',
    'quinta', 'sexta menor', 'sexta mayor', 'séptima menor', 'séptima mayor', 'octava'];
  function intervalo(f1, f2) {
    const st = Math.round(Math.abs(12 * Math.log2(f2 / f1)));
    return st <= 12 ? INTERVALOS[st] : `${st} semitonos`;
  }

  const api = { fft, analizar, Detector, nota, intervalo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Afinador = api;
})(this);
