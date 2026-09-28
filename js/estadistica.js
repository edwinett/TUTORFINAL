// Funciones estadísticas puras (no tocan la página).

const Est = (() => {
  const validos = (a) => a.filter((v) => typeof v === 'number' && Number.isFinite(v));

  function cuantil(ordenado, p) {
    if (!ordenado.length) return null;
    const i = (ordenado.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (i - lo);
  }

  function media(a) {
    a = validos(a);
    return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  }

  function resumen(a) {
    a = validos(a);
    const n = a.length;
    if (!n) return { n: 0, media: null, mediana: null, de: null, min: null, max: null, q1: null, q3: null, cv: null, ic95: null };
    const s = [...a].sort((x, y) => x - y);
    const m = a.reduce((t, v) => t + v, 0) / n;
    const de = n > 1 ? Math.sqrt(a.reduce((t, v) => t + (v - m) ** 2, 0) / (n - 1)) : 0;
    return {
      n, media: m, mediana: cuantil(s, 0.5), de,
      min: s[0], max: s[n - 1], q1: cuantil(s, 0.25), q3: cuantil(s, 0.75),
      cv: m ? (de / m) * 100 : null,
      ic95: n > 1 ? (1.96 * de) / Math.sqrt(n) : null,
    };
  }

  // --- Distribución t (para valores p) mediante la función beta incompleta ---
  function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  }

  function betacf(a, b, x) {
    const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  function betaIncompleta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
  }

  // Valor p de dos colas para un estadístico t con "gl" grados de libertad.
  function pValorT(t, gl) {
    if (!Number.isFinite(t)) return 0;
    return betaIncompleta(gl / (gl + t * t), gl / 2, 0.5);
  }

  function pares(x, y) {
    const px = [], py = [];
    for (let i = 0; i < x.length; i++) {
      if (Number.isFinite(x[i]) && Number.isFinite(y[i])) { px.push(x[i]); py.push(y[i]); }
    }
    return [px, py];
  }

  function pearsonPares(x, y) {
    const n = x.length;
    if (n < 3) return null;
    const mx = x.reduce((s, v) => s + v, 0) / n;
    const my = y.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - mx, dy = y[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    if (!sxx || !syy) return null;
    const r = sxy / Math.sqrt(sxx * syy);
    const t = 1 - r * r <= 1e-12 ? Infinity : r * Math.sqrt((n - 2) / (1 - r * r));
    const b = sxy / sxx;
    return { r, r2: r * r, n, p: pValorT(t, n - 2), pendiente: b, intercepto: my - b * mx };
  }

  function rangos(a) {
    const orden = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    for (let i = 0; i < orden.length;) {
      let j = i;
      while (j + 1 < orden.length && orden[j + 1][0] === orden[i][0]) j++;
      const promedio = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[orden[k][1]] = promedio;
      i = j + 1;
    }
    return r;
  }

  function correlacion(x, y, metodo = 'pearson') {
    const [px, py] = pares(x, y);
    if (metodo === 'spearman') {
      const res = pearsonPares(rangos(px), rangos(py));
      if (res) { // la recta se reporta en la escala original
        const lin = pearsonPares(px, py);
        if (lin) { res.pendiente = lin.pendiente; res.intercepto = lin.intercepto; }
      }
      return res;
    }
    return pearsonPares(px, py);
  }

  // Prueba t de Welch (no asume varianzas iguales) + tamaño del efecto d de Cohen.
  function welch(a, b) {
    const ra = resumen(a), rb = resumen(b);
    if (ra.n < 2 || rb.n < 2) return null;
    const va = ra.de ** 2 / ra.n, vb = rb.de ** 2 / rb.n;
    if (va + vb === 0) return null;
    const t = (ra.media - rb.media) / Math.sqrt(va + vb);
    const gl = (va + vb) ** 2 / (va ** 2 / (ra.n - 1) + vb ** 2 / (rb.n - 1));
    const sp = Math.sqrt(((ra.n - 1) * ra.de ** 2 + (rb.n - 1) * rb.de ** 2) / (ra.n + rb.n - 2));
    return { a: ra, b: rb, diferencia: ra.media - rb.media, t, gl, p: pValorT(t, gl), d: sp ? (ra.media - rb.media) / sp : 0 };
  }

  function histograma(a, ancho, maximo) {
    a = validos(a);
    if (!a.length) return [];
    const inicio = Math.floor(Math.min(...a) / ancho) * ancho;
    const fin = Math.min(Math.floor(Math.max(...a) / ancho) * ancho, maximo - ancho);
    const clases = [];
    for (let lo = inicio; lo <= fin; lo += ancho) clases.push({ desde: lo, hasta: lo + ancho, n: 0 });
    for (const v of a) {
      let i = Math.floor((v - inicio) / ancho);
      if (i >= clases.length) i = clases.length - 1;
      if (i >= 0) clases[i].n++;
    }
    return clases;
  }

  return { validos, media, resumen, correlacion, welch, histograma, pValorT };
})();
