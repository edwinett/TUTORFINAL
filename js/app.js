'use strict';

// ============================================================
//  Estado de la aplicación
// ============================================================

const OPCIONES_LIMPIEZA = [
  { clave: 'resumen', nombre: 'Eliminar filas de totales/promedios y encabezados repetidos dentro de los datos' },
  { clave: 'textos', nombre: 'Normalizar textos de colegio, sede, jornada, etc. (espacios, mayúsculas y tildes), para que "San José" y "SAN JOSE " cuenten como el mismo' },
  { clave: 'genero', nombre: 'Estandarizar el género a F / M ("Femenino", "mujer", "f" → F)' },
  { clave: 'zona', nombre: 'Estandarizar zona (URBANO / RURAL), sector (OFICIAL / NO OFICIAL) y nivel socioeconómico (NSE1 – NSE4). Ej.: "Urbana", "U" → URBANO; "Público" → OFICIAL; "2" → NSE2' },
  { clave: 'rango', nombre: 'Dejar vacíos los puntajes fuera de rango (0–100 por área, 0–500 el global)' },
  { clave: 'duplicados', nombre: 'Eliminar estudiantes repetidos (mismo identificador o nombre en el mismo año)' },
  { clave: 'calcularGlobal', nombre: 'Calcular el puntaje global cuando falte y estén las 5 áreas (fórmula oficial ICFES)' },
  { clave: 'sinPuntajes', nombre: 'Eliminar registros que no tengan ningún puntaje' },
];

const estado = {
  archivos: [],
  datos: [],
  limpieza: null,
  desactualizado: false,
  filtros: { anio: '', region: '', departamento: '', etc: '', municipio: '', zona: '', naturaleza: '', nse: '', genero: '', colegio: '', jornada: '' },
  opciones: Object.fromEntries(OPCIONES_LIMPIEZA.map((o) => [o.clave, true])),
  ui: {
    pestana: 'cargar',
    grafico: { tipo: 'promedios', puntaje: 'global', area: 'matematicas', dim: 'colegio', serie: 'areas', x: 'lectura', y: 'sociales' },
    comparar: { dim: 'colegio', filas: 'colegio', columnas: 'anio', metrica: 'global', dimPrueba: 'genero', a: '', b: '', puntajePrueba: 'global' },
    corr: { nivel: 'estudiantes', metodo: 'pearson', x: 'lectura', y: 'sociales' },
    informe: {
      titulo: '', autor: '', notas: '', anio: '', comparacion: '', territorio: '', maxTerritorios: 30,
      secciones: { contexto: true, promedios: true, brechas: true, niveles: true, territorios: true, conclusiones: true, anexos: true },
    },
  },
  graficos: {},
};

// ============================================================
//  Utilidades
// ============================================================

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtP = (p) => (p == null ? '—' : p < 0.001 ? '< 0,001' : fmt(p, 3));
const redondear = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const puntaje = (clave) => PUNTAJES.find((p) => p.clave === clave);
const dimension = (clave) => DIMENSIONES.find((d) => d.clave === clave);
const col = (datos, clave) => datos.map((r) => r[clave]);
const letraColumna = (j) => { let s = ''; j++; while (j > 0) { const m = (j - 1) % 26; s = String.fromCharCode(65 + m) + s; j = Math.floor((j - 1) / 26); } return s; };

function etiqueta(dim, v) {
  if (v === '' || v == null) return '(sin dato)';
  if (dim === 'genero') return v === 'F' ? 'Mujeres' : v === 'M' ? 'Hombres' : v;
  if (dim === 'naturaleza') return v === 'OFICIAL' ? 'Oficial' : v === 'NO OFICIAL' ? 'No oficial' : v;
  if (dim === 'nse') return /^NSE\d$/.test(v) ? `NSE ${v.slice(3)}` : v;
  if (dim === 'zona') return v === 'URBANO' ? 'Urbana' : v === 'RURAL' ? 'Rural' : v;
  return String(v);
}

function opcionesHtml(lista, sel) {
  return lista.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(t)}</option>`).join('');
}

function selector(nombre, valor, lista, rotulo) {
  return `<label class="control">${esc(rotulo)}<select data-ui="${nombre}">${opcionesHtml(lista, valor)}</select></label>`;
}

const listaPuntajes = (incluirGlobal = true) => (incluirGlobal ? PUNTAJES : AREAS).map((p) => [p.clave, p.nombre]);

function ordenar(vals) {
  return vals.sort((a, b) => {
    if (a === '') return 1;
    if (b === '') return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'es', { numeric: true });
  });
}

function valores(datos, dim) { return ordenar([...new Set(datos.map((r) => r[dim]))]); }

function agrupar(datos, dim) {
  const m = new Map();
  for (const r of datos) {
    const k = r[dim];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return ordenar([...m.keys()]).map((k) => ({ clave: k, filas: m.get(k) }));
}

function dimensionesDisponibles(datos) {
  return DIMENSIONES.filter((d) => new Set(datos.map((r) => r[d.clave]).filter((v) => v !== '' && v != null)).size >= 1);
}

function filtrados() {
  const f = estado.filtros;
  return estado.datos.filter((r) => Object.entries(f).every(([k, v]) => v === '' || String(r[k]) === v));
}

function distribucionNiveles(datos, area) {
  const vals = Est.validos(col(datos, area.clave));
  const total = vals.length;
  const cuenta = Object.fromEntries(area.niveles.map((n) => [n.nombre, 0]));
  for (const v of vals) cuenta[nivelDe(area, v)]++;
  return { total, niveles: area.niveles.map((n) => ({ nivel: n.nombre, n: cuenta[n.nombre], pct: total ? (cuenta[n.nombre] / total) * 100 : null })) };
}

function avisar(texto, tipo = '') {
  const div = document.createElement('div');
  div.className = tipo;
  div.textContent = texto;
  $('#avisos').appendChild(div);
  setTimeout(() => div.remove(), tipo === 'error' ? 7000 : 3500);
}

function descargarLibro(wb, nombre) { XLSX.writeFile(wb, nombre); }

function descripcionFiltros() {
  const partes = Object.entries(estado.filtros).filter(([, v]) => v !== '').map(([k, v]) => `${dimension(k).nombre}: ${etiqueta(k, v)}`);
  return partes.length ? partes.join(' · ') : 'Todos los datos cargados';
}

function vacio() {
  return '<div class="tarjeta"><div class="alerta aviso">No hay registros con los filtros actuales. Cambie o limpie los filtros de arriba.</div></div>';
}

// ============================================================
//  Gráficos (Chart.js)
// ============================================================

Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
Chart.defaults.color = '#334155';
Chart.defaults.animation.duration = 300;
Chart.register({
  id: 'fondoBlanco',
  beforeDraw(chart) {
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
});

function dibujar(clave, contenedor, config) {
  if (estado.graficos[clave]) estado.graficos[clave].destroy();
  if (!contenedor) return null;
  contenedor.innerHTML = '<canvas></canvas>';
  config.options = { responsive: true, maintainAspectRatio: false, ...config.options };
  estado.graficos[clave] = new Chart(contenedor.querySelector('canvas'), config);
  return estado.graficos[clave];
}

function titulo(texto) { return { display: true, text: texto, font: { size: 15, weight: 'bold' }, padding: { bottom: 12 } }; }
function ejeTitulo(texto) { return { display: true, text: texto }; }

function cfgPromedios(datos) {
  const medias = AREAS.map((a) => Est.media(col(datos, a.clave)));
  return {
    type: 'bar',
    data: { labels: AREAS.map((a) => a.nombre), datasets: [{ label: 'Promedio', data: medias.map((v) => redondear(v, 1)), backgroundColor: AREAS.map((a) => a.color) }] },
    options: {
      plugins: { title: titulo('Promedio por área (escala 0–100)'), legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100, title: ejeTitulo('Puntaje promedio') } },
    },
  };
}

function cfgNiveles(datos, areas) {
  const nombres = areas[0].niveles.map((n) => n.nombre);
  const dist = areas.map((a) => distribucionNiveles(datos, a));
  const esIngles = areas.length === 1 && areas[0].clave === 'ingles';
  return {
    type: 'bar',
    data: {
      labels: areas.map((a) => a.nombre),
      datasets: nombres.map((nv, i) => ({
        label: esIngles ? nv : `Nivel ${nv}`,
        data: dist.map((d) => redondear(d.niveles[i].pct, 1)),
        backgroundColor: COLORES_NIVEL[nv],
      })),
    },
    options: {
      indexAxis: 'y',
      plugins: {
        title: titulo(esIngles ? 'Niveles de desempeño en Inglés (% de estudiantes)' : 'Niveles de desempeño por área (% de estudiantes)'),
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.raw)}%` } },
      },
      scales: { x: { stacked: true, max: 100, title: ejeTitulo('% de estudiantes') }, y: { stacked: true } },
    },
  };
}

function cfgNivelesArea(datos, area) {
  const d = distribucionNiveles(datos, area);
  return {
    type: 'bar',
    data: {
      labels: d.niveles.map((n) => (area.clave === 'ingles' ? n.nivel : `Nivel ${n.nivel}`)),
      datasets: [{ label: '% de estudiantes', data: d.niveles.map((n) => redondear(n.pct, 1)), backgroundColor: d.niveles.map((n) => COLORES_NIVEL[n.nivel]) }],
    },
    options: {
      plugins: {
        title: titulo(`Niveles de desempeño — ${area.nombre}`), legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${fmt(c.raw)}% (${d.niveles[c.dataIndex].n} estudiantes)` } },
      },
      scales: { y: { beginAtZero: true, max: 100, title: ejeTitulo('% de estudiantes') } },
    },
  };
}

function cfgHistograma(datos, p) {
  const ancho = p.max === 500 ? 25 : 5;
  const clases = Est.histograma(col(datos, p.clave), ancho, p.max);
  const media = Est.media(col(datos, p.clave));
  return {
    type: 'bar',
    data: {
      labels: clases.map((c) => `${c.desde}–${c.hasta - 1}`),
      datasets: [{ label: 'Estudiantes', data: clases.map((c) => c.n), backgroundColor: p.color, barPercentage: 1, categoryPercentage: 0.95 }],
    },
    options: {
      plugins: { title: titulo(`Distribución de puntajes — ${p.nombre} (promedio ${fmt(media)})`), legend: { display: false } },
      scales: { x: { title: ejeTitulo('Rango de puntaje') }, y: { beginAtZero: true, title: ejeTitulo('Número de estudiantes') } },
    },
  };
}

function cfgGrupos(datos, dim, p) {
  let grupos = agrupar(datos, dim).map((g) => ({ ...g, media: Est.media(col(g.filas, p.clave)), n: Est.validos(col(g.filas, p.clave)).length })).filter((g) => g.n);
  if (dim !== 'anio') grupos = grupos.sort((a, b) => b.media - a.media);
  return {
    type: 'bar',
    data: {
      labels: grupos.map((g) => etiqueta(dim, g.clave)),
      datasets: [{ label: `Promedio ${p.nombre}`, data: grupos.map((g) => redondear(g.media, 1)), backgroundColor: grupos.map((_, i) => COLORES_GRUPO[i % COLORES_GRUPO.length]) }],
    },
    options: {
      plugins: {
        title: titulo(`${p.nombre}: promedio por ${dimension(dim).nombre.toLowerCase()}`), legend: { display: false },
        tooltip: { callbacks: { afterLabel: (c) => `${grupos[c.dataIndex].n} estudiantes` } },
      },
      scales: { y: { beginAtZero: true, max: p.max, title: ejeTitulo('Puntaje promedio') } },
    },
  };
}

function cfgEvolucion(datos, serie, p) {
  const anios = valores(datos, 'anio').filter((v) => v !== '');
  let datasets;
  if (serie === 'areas') {
    datasets = AREAS.map((a) => ({
      label: a.nombre, borderColor: a.color, backgroundColor: a.color, tension: 0.2,
      data: anios.map((y) => redondear(Est.media(col(datos.filter((r) => r.anio === y), a.clave)), 1)),
    }));
  } else {
    datasets = agrupar(datos, serie).filter((g) => g.clave !== '').slice(0, 12).map((g, i) => ({
      label: etiqueta(serie, g.clave), borderColor: COLORES_GRUPO[i % 10], backgroundColor: COLORES_GRUPO[i % 10], tension: 0.2,
      data: anios.map((y) => redondear(Est.media(col(g.filas.filter((r) => r.anio === y), p.clave)), 1)),
    }));
  }
  const nombre = serie === 'areas' ? 'Promedio por área' : `${p.nombre} por ${dimension(serie).nombre.toLowerCase()}`;
  return {
    type: 'line',
    data: { labels: anios.map(String), datasets },
    options: {
      spanGaps: true,
      plugins: { title: titulo(`Evolución por año — ${nombre}`) },
      scales: { y: { title: ejeTitulo('Puntaje promedio') }, x: { title: ejeTitulo('Año') } },
    },
  };
}

function cfgDispersion(filas, px, py, metodo = 'pearson', rotular = null) {
  const pts = filas.filter((r) => r[px.clave] != null && r[py.clave] != null);
  const paso = Math.max(1, Math.ceil(pts.length / 4000));
  const muestra = pts.filter((_, i) => i % paso === 0);
  const c = Est.correlacion(col(filas, px.clave), col(filas, py.clave), metodo);
  const datasets = [{
    label: rotular ? 'Grupos' : 'Estudiantes', data: muestra.map((r) => ({ x: r[px.clave], y: r[py.clave], etiqueta: rotular ? rotular(r) : '' })),
    backgroundColor: 'rgba(37, 99, 235, .45)', pointRadius: rotular ? 6 : 3,
  }];
  if (c) {
    const xs = pts.map((r) => r[px.clave]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    datasets.push({
      type: 'line', label: 'Recta de tendencia', borderColor: '#dc2626', borderWidth: 2, pointRadius: 0,
      data: [{ x: x0, y: c.intercepto + c.pendiente * x0 }, { x: x1, y: c.intercepto + c.pendiente * x1 }],
    });
  }
  return {
    type: 'scatter',
    data: { datasets },
    options: {
      plugins: {
        title: titulo(`${px.nombre} vs ${py.nombre}${c ? ` (r = ${fmt(c.r, 2)})` : ''}`),
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw.etiqueta ? ctx.raw.etiqueta + ': ' : ''}(${fmt(ctx.raw.x)}, ${fmt(ctx.raw.y)})` } },
      },
      scales: { x: { title: ejeTitulo(px.nombre) }, y: { title: ejeTitulo(py.nombre) } },
    },
  };
}

function cfgComparacionAreas(datos, dim) {
  const grupos = agrupar(datos, dim).slice(0, 10);
  return {
    type: 'bar',
    data: {
      labels: AREAS.map((a) => a.nombre),
      datasets: grupos.map((g, i) => ({
        label: etiqueta(dim, g.clave), backgroundColor: COLORES_GRUPO[i % 10],
        data: AREAS.map((a) => redondear(Est.media(col(g.filas, a.clave)), 1)),
      })),
    },
    options: {
      plugins: { title: titulo(`Promedio por área según ${dimension(dim).nombre.toLowerCase()}`) },
      scales: { y: { beginAtZero: true, max: 100, title: ejeTitulo('Puntaje promedio') } },
    },
  };
}

function cfgCruzada(datos, filasDim, colDim, p) {
  const columnas = valores(datos, colDim).filter((v) => v !== '');
  const grupos = agrupar(datos, filasDim).slice(0, 12);
  const linea = colDim === 'anio';
  return {
    type: linea ? 'line' : 'bar',
    data: {
      labels: columnas.map((v) => etiqueta(colDim, v)),
      datasets: grupos.map((g, i) => ({
        label: etiqueta(filasDim, g.clave), borderColor: COLORES_GRUPO[i % 10], backgroundColor: COLORES_GRUPO[i % 10], tension: 0.2,
        data: columnas.map((c) => redondear(Est.media(col(g.filas.filter((r) => r[colDim] === c), p.clave)), 1)),
      })),
    },
    options: {
      spanGaps: true,
      plugins: { title: titulo(`${p.nombre}: ${dimension(filasDim).nombre.toLowerCase()} × ${dimension(colDim).nombre.toLowerCase()}`) },
      scales: { y: { title: ejeTitulo('Puntaje promedio') } },
    },
  };
}

// Convierte un gráfico en imagen (para el informe imprimible).
function imagenDe(config, ancho = 900, alto = 380) {
  const caja = document.createElement('div');
  caja.style.cssText = `position:fixed;left:-10000px;top:0;width:${ancho}px;height:${alto}px`;
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho; lienzo.height = alto;
  caja.appendChild(lienzo);
  document.body.appendChild(caja);
  config.options = { ...config.options, animation: false, responsive: false, devicePixelRatio: 2 };
  const g = new Chart(lienzo, config);
  const url = g.toBase64Image('image/png');
  g.destroy();
  caja.remove();
  return url;
}

function descargarGrafico(clave, nombre) {
  const g = estado.graficos[clave];
  if (!g) return;
  const a = document.createElement('a');
  a.href = g.toBase64Image('image/png');
  a.download = `${nombre}.png`;
  a.click();
}

// ============================================================
//  Tablas reutilizables (pantalla e informe)
// ============================================================

function htmlDescriptivas(datos) {
  const filas = PUNTAJES.map((p) => {
    const r = Est.resumen(col(datos, p.clave));
    return `<tr><td>${esc(p.nombre)}</td><td>${r.n}</td><td><strong>${fmt(r.media)}</strong></td><td>± ${fmt(r.ic95)}</td><td>${fmt(r.mediana)}</td>
      <td>${fmt(r.de)}</td><td>${fmt(r.min, 0)}</td><td>${fmt(r.q1)}</td><td>${fmt(r.q3)}</td><td>${fmt(r.max, 0)}</td><td>${fmt(r.cv)}%</td></tr>`;
  }).join('');
  return `<div class="tabla-envoltura"><table>
    <thead><tr><th>Prueba</th><th>N</th><th>Promedio</th><th>IC 95%</th><th>Mediana</th><th>Desv. estándar</th><th>Mínimo</th><th>Q1</th><th>Q3</th><th>Máximo</th><th>Coef. variación</th></tr></thead>
    <tbody>${filas}</tbody></table></div>`;
}

function htmlNiveles(datos) {
  const tabla = (areas) => {
    const nombres = areas[0].niveles.map((n) => n.nombre);
    const esIngles = areas[0].clave === 'ingles';
    const filas = areas.map((a) => {
      const d = distribucionNiveles(datos, a);
      return `<tr><td>${esc(a.nombre)}</td><td>${d.total}</td>${d.niveles.map((n) => `<td>${fmt(n.pct)}% <span class="nota">(${n.n})</span></td>`).join('')}</tr>`;
    }).join('');
    return `<div class="tabla-envoltura"><table><thead><tr><th>Área</th><th>N</th>${nombres.map((n) => `<th>${esIngles ? n : 'Nivel ' + n}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table></div>`;
  };
  return tabla(AREAS.slice(0, 4)) + tabla([AREAS[4]]);
}

function htmlComparacion(datos, dim) {
  const general = Est.media(col(datos, 'global'));
  const grupos = agrupar(datos, dim);
  const filas = grupos.map((g) => {
    const mg = Est.media(col(g.filas, 'global'));
    const dif = mg != null && general != null ? mg - general : null;
    return `<tr><td class="texto">${esc(etiqueta(dim, g.clave))}</td><td>${g.filas.length}</td>
      ${PUNTAJES.map((p) => `<td>${fmt(Est.media(col(g.filas, p.clave)))}</td>`).join('')}
      <td class="${dif > 0 ? 'positivo' : dif < 0 ? 'negativo' : ''}">${dif == null ? '—' : (dif > 0 ? '+' : '') + fmt(dif)}</td></tr>`;
  }).join('');
  return `<div class="tabla-envoltura"><table>
    <thead><tr><th class="texto">${esc(dimension(dim).nombre)}</th><th>N</th>${PUNTAJES.map((p) => `<th>${esc(p.corto)}</th>`).join('')}<th>Global vs. total</th></tr></thead>
    <tbody>${filas}
      <tr><td class="texto"><strong>Total</strong></td><td><strong>${datos.length}</strong></td>${PUNTAJES.map((p) => `<td><strong>${fmt(Est.media(col(datos, p.clave)))}</strong></td>`).join('')}<td></td></tr>
    </tbody></table></div>`;
}

function htmlCruzada(datos, filasDim, colDim, p) {
  const columnas = valores(datos, colDim);
  const grupos = agrupar(datos, filasDim);
  const conCambio = colDim === 'anio' && columnas.filter((c) => c !== '').length > 1;
  const filas = grupos.map((g) => {
    const medias = columnas.map((c) => {
      const sub = Est.validos(col(g.filas.filter((r) => r[colDim] === c), p.clave));
      return { m: Est.media(sub), n: sub.length };
    });
    let cambio = '';
    if (conCambio) {
      const conDato = medias.filter((x, i) => x.m != null && columnas[i] !== '');
      const d = conDato.length > 1 ? conDato[conDato.length - 1].m - conDato[0].m : null;
      cambio = `<td class="${d > 0 ? 'positivo' : d < 0 ? 'negativo' : ''}">${d == null ? '—' : (d > 0 ? '+' : '') + fmt(d)}</td>`;
    }
    return `<tr><td class="texto">${esc(etiqueta(filasDim, g.clave))}</td>${medias.map((x) => `<td>${fmt(x.m)}${x.n ? ` <span class="nota">(${x.n})</span>` : ''}</td>`).join('')}${cambio}</tr>`;
  }).join('');
  return `<div class="tabla-envoltura"><table>
    <thead><tr><th class="texto">${esc(dimension(filasDim).nombre)} \\ ${esc(dimension(colDim).nombre)}</th>${columnas.map((c) => `<th>${esc(etiqueta(colDim, c))}</th>`).join('')}${conCambio ? '<th>Cambio (primer → último año)</th>' : ''}</tr></thead>
    <tbody>${filas}</tbody></table></div>
    <p class="nota">Cada celda muestra el promedio de ${esc(p.nombre)} y, entre paréntesis, el número de estudiantes.</p>`;
}

function datosCorrelacion(datos, nivel) {
  if (nivel === 'estudiantes') return datos;
  const dims = nivel === 'colegio' ? ['colegio'] : ['colegio', 'anio'];
  const m = new Map();
  for (const r of datos) {
    const k = dims.map((d) => etiqueta(d, r[d])).join(' · ');
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return [...m.entries()].map(([k, filas]) => {
    const o = { etiqueta: k };
    for (const p of PUNTAJES) o[p.clave] = Est.media(col(filas, p.clave));
    return o;
  });
}

function matrizCorrelacion(filas, metodo) {
  return PUNTAJES.map((a) => PUNTAJES.map((b) => (a === b ? { r: 1, n: Est.validos(col(filas, a.clave)).length, p: 0 } : Est.correlacion(col(filas, a.clave), col(filas, b.clave), metodo))));
}

function colorCorrelacion(r) {
  if (r == null) return 'background:#f1f5f9';
  const a = Math.min(1, Math.abs(r));
  const base = r >= 0 ? '37, 99, 235' : '220, 38, 38';
  return `background:rgba(${base}, ${0.08 + a * 0.82});color:${a > 0.55 ? '#fff' : '#0f172a'}`;
}

function htmlMatriz(matriz, sel = null) {
  return `<div class="tabla-envoltura"><table class="matriz">
    <thead><tr><th></th>${PUNTAJES.map((p) => `<th style="text-align:center">${esc(p.corto)}</th>`).join('')}</tr></thead>
    <tbody>${PUNTAJES.map((a, i) => `<tr><th>${esc(a.corto)}</th>${PUNTAJES.map((b, j) => {
      const c = matriz[i][j];
      const marcado = sel && ((sel[0] === a.clave && sel[1] === b.clave) || (sel[0] === b.clave && sel[1] === a.clave)) ? ' sel' : '';
      return `<td class="${marcado.trim()}" style="${colorCorrelacion(c?.r)}" data-x="${a.clave}" data-y="${b.clave}" title="n = ${c?.n ?? 0}">${c ? fmt(c.r, 2) : '—'}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function fuerza(r) {
  const a = Math.abs(r);
  if (a < 0.1) return 'prácticamente nula';
  if (a < 0.3) return 'débil';
  if (a < 0.5) return 'moderada';
  if (a < 0.7) return 'fuerte';
  return 'muy fuerte';
}

function tamanoEfecto(d) {
  const a = Math.abs(d);
  if (a < 0.2) return 'muy pequeño';
  if (a < 0.5) return 'pequeño';
  if (a < 0.8) return 'mediano';
  return 'grande';
}

function conclusiones(datos) {
  const c = [];
  const g = Est.resumen(col(datos, 'global'));
  if (g.n) c.push(`El puntaje global promedio fue <strong>${fmt(g.media)}</strong> sobre 500 (desviación estándar ${fmt(g.de)}), con ${g.n} estudiantes evaluados.`);

  const areas = AREAS.map((a) => ({ a, m: Est.media(col(datos, a.clave)) })).filter((x) => x.m != null).sort((x, y) => y.m - x.m);
  if (areas.length > 1) c.push(`El área con mejor promedio fue <strong>${areas[0].a.nombre}</strong> (${fmt(areas[0].m)}) y la de menor promedio fue <strong>${areas.at(-1).a.nombre}</strong> (${fmt(areas.at(-1).m)}).`);

  const bajos = AREAS.slice(0, 4).map((a) => ({ a, pct: distribucionNiveles(datos, a).niveles[0].pct })).filter((x) => x.pct != null).sort((x, y) => y.pct - x.pct);
  if (bajos.length && bajos[0].pct > 0) c.push(`<strong>${bajos[0].a.nombre}</strong> tiene el mayor porcentaje de estudiantes en nivel 1 (${fmt(bajos[0].pct)}%): es un área prioritaria para planes de refuerzo.`);

  const ing = distribucionNiveles(datos, AREAS[4]);
  if (ing.total) {
    const aMenos = ing.niveles[0].pct;
    const b = ing.niveles.slice(3).reduce((t, n) => t + n.pct, 0);
    c.push(`En Inglés, el ${fmt(aMenos)}% de los estudiantes quedó en nivel A- y el ${fmt(b)}% alcanzó B1 o superior.`);
  }

  const anios = agrupar(datos, 'anio').filter((x) => x.clave !== '');
  if (anios.length > 1) {
    const m1 = Est.media(col(anios[0].filas, 'global')), m2 = Est.media(col(anios.at(-1).filas, 'global'));
    if (m1 != null && m2 != null) {
      const d = m2 - m1;
      c.push(`Entre ${anios[0].clave} y ${anios.at(-1).clave} el puntaje global promedio ${d >= 0 ? 'subió' : 'bajó'} <strong>${fmt(Math.abs(d))} puntos</strong> (de ${fmt(m1)} a ${fmt(m2)}).`);
    }
  }

  const colegios = agrupar(datos, 'colegio').filter((x) => x.clave !== '').map((x) => ({ ...x, m: Est.media(col(x.filas, 'global')) })).filter((x) => x.m != null).sort((a, b) => b.m - a.m);
  if (colegios.length > 1) {
    const w = Est.welch(col(colegios[0].filas, 'global'), col(colegios.at(-1).filas, 'global'));
    c.push(`Entre los ${colegios.length} colegios, el promedio global más alto es el de <strong>${esc(colegios[0].clave)}</strong> (${fmt(colegios[0].m)}) y el más bajo el de <strong>${esc(colegios.at(-1).clave)}</strong> (${fmt(colegios.at(-1).m)}): una brecha de ${fmt(colegios[0].m - colegios.at(-1).m)} puntos${w ? (w.p < 0.05 ? ', estadísticamente significativa (p ' + (w.p < 0.001 ? '< 0,001' : '= ' + fmtP(w.p)) + ')' : ', que no resulta estadísticamente significativa') : ''}.`);
  }

  const urb = datos.filter((r) => r.zona === 'URBANO'), rur = datos.filter((r) => r.zona === 'RURAL');
  if (urb.length > 1 && rur.length > 1) {
    const w = Est.welch(col(urb, 'global'), col(rur, 'global'));
    if (w) {
      const brechas = AREAS.map((a) => ({ a, d: Est.media(col(urb, a.clave)) - Est.media(col(rur, a.clave)) })).filter((x) => Number.isFinite(x.d)).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
      c.push(`Por zona, el promedio global fue ${fmt(w.a.media)} en la zona urbana (${w.a.n} estudiantes) y ${fmt(w.b.media)} en la rural (${w.b.n}); una diferencia de <strong>${fmt(Math.abs(w.diferencia))} puntos</strong> a favor de la zona ${w.diferencia >= 0 ? 'urbana' : 'rural'}, que ${w.p < 0.05 ? 'es' : 'no es'} estadísticamente significativa (p ${w.p < 0.001 ? '< 0,001' : '= ' + fmtP(w.p)}).${brechas.length ? ` La mayor brecha por área está en ${brechas[0].a.nombre} (${fmt(Math.abs(brechas[0].d))} puntos).` : ''}`);
    }
  }

  const municipios = agrupar(datos, 'municipio').filter((x) => x.clave !== '').map((x) => ({ ...x, m: Est.media(col(x.filas, 'global')) })).filter((x) => x.m != null).sort((a, b) => b.m - a.m);
  if (municipios.length > 1) {
    c.push(`Entre los ${municipios.length} municipios, el promedio global más alto es el de <strong>${esc(municipios[0].clave)}</strong> (${fmt(municipios[0].m)}) y el más bajo el de <strong>${esc(municipios.at(-1).clave)}</strong> (${fmt(municipios.at(-1).m)}).`);
  }

  const f = datos.filter((r) => r.genero === 'F'), m = datos.filter((r) => r.genero === 'M');
  if (f.length > 1 && m.length > 1) {
    const w = Est.welch(col(f, 'global'), col(m, 'global'));
    if (w) c.push(`Por género, el promedio global fue ${fmt(w.a.media)} en mujeres y ${fmt(w.b.media)} en hombres; la diferencia ${w.p < 0.05 ? 'es' : 'no es'} estadísticamente significativa (p ${w.p < 0.001 ? '< 0,001' : '= ' + fmtP(w.p)}).`);
  }

  let mejor = null;
  for (let i = 0; i < AREAS.length; i++) {
    for (let j = i + 1; j < AREAS.length; j++) {
      const r = Est.correlacion(col(datos, AREAS[i].clave), col(datos, AREAS[j].clave));
      if (r && (!mejor || r.r > mejor.r.r)) mejor = { a: AREAS[i], b: AREAS[j], r };
    }
  }
  if (mejor) c.push(`La relación más fuerte entre áreas es entre <strong>${mejor.a.nombre}</strong> y <strong>${mejor.b.nombre}</strong> (r = ${fmt(mejor.r.r, 2)}, ${fuerza(mejor.r.r)}): quienes puntúan alto en una tienden a puntuar alto en la otra.`);
  return c;
}

// ============================================================
//  Navegación
// ============================================================

const ANALISIS = ['estadisticas', 'graficos', 'comparar', 'correlaciones', 'informe'];

function mostrar(p) {
  if (ANALISIS.includes(p) && !estado.datos.length) { avisar('Primero cargue y limpie los datos (pasos 1 y 2).'); return; }
  estado.ui.pestana = p;
  document.querySelectorAll('#pestanas button').forEach((b) => b.classList.toggle('activa', b.dataset.tab === p));
  document.querySelectorAll('.pestana').forEach((s) => { s.hidden = s.id !== `tab-${p}`; });
  $('#filtros').hidden = !ANALISIS.includes(p);
  render();
  window.scrollTo({ top: 0 });
}

function render() {
  const p = estado.ui.pestana;
  ({ cargar: renderCargar, limpiar: renderLimpiar, estadisticas: renderEstadisticas, graficos: renderGraficos, comparar: renderComparar, correlaciones: renderCorrelaciones, informe: renderInforme })[p]();
}

function actualizarNav() {
  document.querySelectorAll('#pestanas button').forEach((b) => {
    if (ANALISIS.includes(b.dataset.tab)) b.disabled = !estado.datos.length;
  });
}

// ============================================================
//  1. Cargar
// ============================================================

async function agregarArchivos(files) {
  for (const f of files) {
    try {
      const hojas = await Datos.leerArchivo(f);
      estado.archivos.push(Datos.prepararArchivo(f.name, hojas));
      avisar(`Archivo leído: ${f.name}`);
    } catch (e) {
      console.error(e);
      avisar(`No se pudo leer "${f.name}". ¿Es un Excel o CSV válido? (${e.message})`, 'error');
    }
  }
  estado.desactualizado = true;
  renderCargar();
}

function tarjetaArchivo(a) {
  const filas = a.hojas[a.hoja] || [];
  const nDatos = Math.max(0, filas.length - a.filaEncabezado - 1);
  const opcionesCol = [[-1, '— no usar —'], ...a.encabezados.map((h, j) => [j, `${letraColumna(j)} · ${h}`])];
  const reconocidos = CAMPOS.filter((c) => a.mapeo[c.clave] >= 0);
  const puntajesOk = CAMPOS.filter((c) => c.numerico && a.mapeo[c.clave] >= 0).length;
  const campos = CAMPOS.map((c) => `<label class="campo ${a.mapeo[c.clave] >= 0 ? 'ok' : ''}"><span>${esc(c.nombre)}</span>
    <select data-accion="mapeo" data-campo="${c.clave}">${opcionesHtml(opcionesCol, a.mapeo[c.clave])}</select></label>`).join('');
  const vista = filas.slice(a.filaEncabezado + 1, a.filaEncabezado + 6);
  const tablaVista = reconocidos.length ? `<div class="tabla-envoltura"><table><thead><tr>${reconocidos.map((c) => `<th class="texto">${esc(c.nombre)}</th>`).join('')}</tr></thead>
    <tbody>${vista.map((f) => `<tr>${reconocidos.map((c) => `<td class="texto">${esc(f[a.mapeo[c.clave]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="nota">Aún no hay columnas reconocidas.</p>';

  let alertas = '';
  if (!puntajesOk) alertas += '<div class="alerta error">No se reconoció ninguna columna de puntajes. Revise la fila de encabezados o elija las columnas manualmente abajo.</div>';
  else if (puntajesOk < 6) alertas += `<div class="alerta aviso">Se reconocieron ${puntajesOk} de 6 columnas de puntaje. Si falta alguna, elíjala abajo.</div>`;
  if (a.mapeo.periodo < 0 && !a.anioManual) alertas += '<div class="alerta aviso">El archivo no tiene columna de año. Escriba el año en la casilla de arriba para poder comparar entre años.</div>';
  if (a.mapeo.zona < 0 && !a.zonaManual) alertas += '<div class="alerta info">El archivo no tiene columna de zona (COLE_AREA_UBICACION). Si todo el archivo es de una sola zona, elíjala arriba para poder comparar urbana vs. rural.</div>';
  if (a.mapeo.colegio < 0 && !a.colegioManual) alertas += '<div class="alerta info">El archivo no tiene columna de colegio. Si es de un solo colegio, escriba su nombre arriba para poder compararlo con otros.</div>';

  return `<article class="tarjeta" data-archivo="${a.id}">
    <div class="archivo-cab"><h3>📄 ${esc(a.nombre)}</h3><button class="btn-texto" data-accion="quitar">Quitar archivo</button></div>
    <div class="fila-controles">
      <label class="control">Hoja<select data-accion="hoja">${opcionesHtml(Object.keys(a.hojas).map((h) => [h, `${h} (${a.hojas[h].length} filas)`]), a.hoja)}</select></label>
      <label class="control">Fila de encabezados<input type="number" min="1" max="${filas.length}" data-accion="encabezado" value="${a.filaEncabezado + 1}"></label>
      <label class="control">Año (si no viene en el archivo)<input data-accion="anio" value="${esc(a.anioManual)}" placeholder="Ej: 2024"></label>
      <label class="control">Colegio (si no viene en el archivo)<input data-accion="colegio" value="${esc(a.colegioManual)}" placeholder="Nombre del colegio"></label>
      <label class="control">Municipio (si no viene en el archivo)<input data-accion="municipio" value="${esc(a.municipioManual)}" placeholder="Ej: Rionegro"></label>
      <label class="control">Zona (si no viene en el archivo)<select data-accion="zona">${opcionesHtml([['', '—'], ['URBANO', 'Urbana'], ['RURAL', 'Rural']], a.zonaManual)}</select></label>
    </div>
    <p class="nota">${nDatos} filas debajo de los encabezados · ${reconocidos.length} columnas reconocidas automáticamente</p>
    ${alertas}
    <details${puntajesOk < 6 ? ' open' : ''}><summary>Columnas reconocidas (revise y corrija si hace falta)</summary><div class="rejilla-campos">${campos}</div></details>
    <details><summary>Vista previa de las primeras filas</summary>${tablaVista}</details>
  </article>`;
}

function renderCargar() {
  $('#lista-archivos').innerHTML = estado.archivos.map(tarjetaArchivo).join('');
  $('#continuar-limpieza').hidden = !estado.archivos.length;
}

function archivoDe(el) {
  const art = el.closest('[data-archivo]');
  return art ? estado.archivos.find((a) => a.id === Number(art.dataset.archivo)) : null;
}

function alCambiarArchivo(e) {
  const el = e.target;
  const a = archivoDe(el);
  if (!a || !el.dataset.accion) return;
  const accion = el.dataset.accion;
  if (accion === 'hoja') Datos.cambiarHoja(a, el.value);
  else if (accion === 'encabezado') {
    const n = Math.max(1, Math.min(Number(el.value) || 1, (a.hojas[a.hoja] || []).length || 1));
    a.filaEncabezado = n - 1;
    Datos.aplicarEncabezado(a);
  } else if (accion === 'mapeo') a.mapeo[el.dataset.campo] = Number(el.value);
  else if (accion === 'anio') a.anioManual = el.value.trim();
  else if (accion === 'colegio') a.colegioManual = el.value.trim();
  else if (accion === 'municipio') a.municipioManual = el.value.trim();
  else if (accion === 'zona') a.zonaManual = el.value;
  estado.desactualizado = true;
  renderCargar();
}

// ============================================================
//  2. Limpiar
// ============================================================

function procesarDatos() {
  if (!estado.archivos.length) { avisar('Primero cargue al menos un archivo.', 'error'); return; }
  const res = Datos.procesar(estado.archivos, estado.opciones);
  estado.limpieza = res;
  estado.datos = res.datos;
  estado.desactualizado = false;
  for (const k of Object.keys(estado.filtros)) {
    if (estado.filtros[k] !== '' && !estado.datos.some((r) => String(r[k]) === estado.filtros[k])) estado.filtros[k] = '';
  }
  actualizarNav();
  renderFiltros();
  renderLimpiar();
  if (res.datos.length) avisar(`Listo: ${res.datos.length} registros limpios.`);
  else avisar('No quedó ningún registro válido. Revise las columnas reconocidas en el paso 1.', 'error');
}

function filasLegibles(datos) {
  const presentes = (c) => datos.some((r) => r[c] !== '' && r[c] != null);
  const textos = [['archivo', 'Archivo'], ['fila', 'Fila en el archivo'], ['id', 'Identificador'], ['nombre', 'Nombre'], ['anio', 'Año'], ['colegio', 'Colegio'], ['sede', 'Sede'],
    ['region', 'Región'], ['departamento', 'Departamento'], ['etc', 'ETC'], ['municipio', 'Municipio'], ['zona', 'Zona'], ['naturaleza', 'Sector'], ['jornada', 'Jornada'],
    ['genero', 'Sexo'], ['nse', 'Nivel socioeconómico'], ['grupo', 'Grupo']].filter(([c]) => presentes(c));
  return datos.map((r) => {
    const o = {};
    for (const [c, t] of textos) o[t] = r[c];
    for (const p of PUNTAJES) o[p.nombre] = r[p.clave];
    for (const a of AREAS) o[`Nivel ${a.nombre}`] = nivelDe(a, r[a.clave]) ?? '';
    return o;
  });
}

function descargarDatosLimpios() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasLegibles(estado.datos)), 'Datos limpios');
  const l = estado.limpieza;
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(l.pasos.map((p) => ({ Paso: p.texto, Tipo: p.tipo === 'aviso' ? 'Aviso' : 'Corrección', Cantidad: p.cantidad }))), 'Resumen limpieza');
  if (l.problemas.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(l.problemas.map((p) => ({ Archivo: p.archivo, Fila: p.fila, Campo: p.campo, 'Valor original': p.valor, Acción: p.accion }))), 'Detalle correcciones');
  }
  descargarLibro(wb, 'saber11_datos_limpios.xlsx');
}

function renderLimpiar() {
  const cont = $('#tab-limpiar');
  const l = estado.limpieza;
  let html = `<div class="tarjeta"><h2>2. Limpieza de los datos</h2>
    <p>Los archivos reales suelen traer errores: filas de títulos, espacios de más, puntajes escritos con coma, celdas con "N/A", estudiantes repetidos…
      Elija qué correcciones aplicar y pulse <strong>Limpiar y procesar</strong>. Sus archivos originales no se modifican.</p>
    <div class="opciones">${OPCIONES_LIMPIEZA.map((o) => `<label><input type="checkbox" data-opcion="${o.clave}"${estado.opciones[o.clave] ? ' checked' : ''}> ${esc(o.nombre)}</label>`).join('')}</div>
    ${!estado.archivos.length ? '<div class="alerta aviso">Todavía no ha cargado archivos. Vuelva al paso 1.</div>' : ''}
    ${estado.desactualizado && l ? '<div class="alerta aviso">Hizo cambios en los archivos o columnas: vuelva a pulsar "Limpiar y procesar" para aplicarlos.</div>' : ''}
    <div class="fila-botones"><button class="btn" id="btn-procesar">Limpiar y procesar</button></div></div>`;

  if (l) {
    const correcciones = l.pasos.filter((p) => p.tipo === 'correccion').reduce((t, p) => t + p.cantidad, 0);
    const avisos = l.pasos.filter((p) => p.tipo === 'aviso');
    html += `<div class="cifras">
      <div class="cifra"><div class="valor">${l.leidas}</div><div class="rotulo">Filas leídas</div></div>
      <div class="cifra"><div class="valor">${l.datos.length}</div><div class="rotulo">Registros válidos</div></div>
      <div class="cifra"><div class="valor">${correcciones}</div><div class="rotulo">Correcciones aplicadas</div></div>
      <div class="cifra"><div class="valor">${avisos.length}</div><div class="rotulo">Avisos para revisar</div></div></div>
    <div class="tarjeta"><h3>¿Qué se corrigió?</h3>
      ${l.pasos.length ? `<div class="tabla-envoltura"><table><thead><tr><th class="texto">Paso</th><th>Tipo</th><th>Cantidad</th></tr></thead>
        <tbody>${l.pasos.map((p) => `<tr><td class="texto">${esc(p.texto)}</td><td><span class="etiqueta-tipo ${p.tipo}">${p.tipo === 'aviso' ? 'Aviso' : 'Corrección'}</span></td><td>${p.cantidad}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="alerta ok">Los datos estaban limpios: no hubo que corregir nada.</div>'}
      ${l.problemas.length ? `<details><summary>Ver el detalle celda por celda (${l.problemas.length}${l.problemas.length >= 2000 ? '+' : ''})</summary>
        <div class="tabla-envoltura"><table><thead><tr><th class="texto">Archivo</th><th>Fila</th><th class="texto">Campo</th><th class="texto">Valor original</th><th class="texto">Acción</th></tr></thead>
        <tbody>${l.problemas.slice(0, 300).map((p) => `<tr><td class="texto">${esc(p.archivo)}</td><td>${p.fila}</td><td class="texto">${esc(p.campo)}</td><td class="texto">${esc(p.valor) || '<em>(vacío)</em>'}</td><td class="texto">${esc(p.accion)}</td></tr>`).join('')}</tbody></table></div>
        ${l.problemas.length > 300 ? '<p class="nota">Se muestran las primeras 300. El Excel descargable trae la lista completa.</p>' : ''}</details>` : ''}
      <div class="fila-botones"><button class="btn secundario" id="btn-descargar-limpios">Descargar datos limpios (Excel)</button>
        ${l.datos.length ? '<button class="btn" data-ir="estadisticas">Ver estadísticas →</button>' : ''}</div>
    </div>`;
    if (l.datos.length) {
      const muestra = filasLegibles(l.datos.slice(0, 15));
      const cols = Object.keys(muestra[0]).filter((c) => !c.startsWith('Nivel'));
      html += `<div class="tarjeta"><h3>Vista previa de los datos limpios</h3><div class="tabla-envoltura"><table>
        <thead><tr>${cols.map((c) => `<th class="texto">${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${muestra.map((r) => `<tr>${cols.map((c) => `<td class="texto">${esc(typeof r[c] === 'number' ? fmt(r[c], Number.isInteger(r[c]) ? 0 : 1) : r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="nota">Primeras 15 de ${l.datos.length} filas.</p></div>`;
    }
  }
  cont.innerHTML = html;
}

// ============================================================
//  Filtros
// ============================================================

function renderFiltros() {
  const dims = Object.keys(estado.filtros).filter((k) => valores(estado.datos, k).some((v) => v !== ''));
  const html = dims.map((k) => {
    const lista = [['', 'Todos'], ...valores(estado.datos, k).map((v) => [String(v), etiqueta(k, v)])];
    return `<label class="control">${esc(dimension(k).nombre)}<select data-filtro="${k}">${opcionesHtml(lista, estado.filtros[k])}</select></label>`;
  }).join('');
  const n = filtrados().length;
  $('#filtros-contenido').innerHTML = `<strong style="align-self:center">Filtros:</strong>${html}
    <button class="btn-texto" id="btn-quitar-filtros">Quitar filtros</button>
    <span class="conteo">Mostrando <strong>${n}</strong> de ${estado.datos.length} estudiantes</span>`;
}

// ============================================================
//  3. Estadísticas
// ============================================================

function renderEstadisticas() {
  const cont = $('#tab-estadisticas');
  const d = filtrados();
  if (!d.length) { cont.innerHTML = vacio(); return; }
  const g = Est.resumen(col(d, 'global'));
  const nCol = valores(d, 'colegio').filter((v) => v !== '').length;
  const nAnio = valores(d, 'anio').filter((v) => v !== '').length;
  cont.innerHTML = `
    <div class="cifras">
      <div class="cifra"><div class="valor">${d.length}</div><div class="rotulo">Estudiantes</div></div>
      <div class="cifra"><div class="valor">${nCol || '—'}</div><div class="rotulo">Colegios</div></div>
      <div class="cifra"><div class="valor">${nAnio || '—'}</div><div class="rotulo">Años</div></div>
      <div class="cifra"><div class="valor">${fmt(g.media)}</div><div class="rotulo">Puntaje global promedio (de 500)</div></div>
      <div class="cifra"><div class="valor">${fmt(g.de)}</div><div class="rotulo">Desviación estándar del global</div></div>
    </div>
    <div class="tarjeta"><h2>Estadísticas descriptivas</h2>
      <p class="nota">IC 95%: margen dentro del cual está el promedio "real" con 95% de confianza. Coef. de variación: qué tan dispersos están los puntajes respecto al promedio (más alto = grupo más desigual).</p>
      ${htmlDescriptivas(d)}
      <div class="fila-botones"><button class="btn secundario" data-accion-global="excel">Descargar todas las estadísticas (Excel)</button></div>
    </div>
    <div class="tarjeta"><h2>Niveles de desempeño</h2>
      <p class="nota">Niveles según los puntos de corte del ICFES (1 = más bajo, 4 = más alto; en Inglés de A- a B+).</p>
      ${htmlNiveles(d)}
      <div class="dos-columnas"><div class="grafico" id="g-niveles"></div><div class="grafico" id="g-niveles-ingles"></div></div>
    </div>
    <div class="tarjeta"><div class="grafico" id="g-promedios"></div></div>`;
  dibujar('niveles', $('#g-niveles'), cfgNiveles(d, AREAS.slice(0, 4)));
  dibujar('nivelesIngles', $('#g-niveles-ingles'), cfgNiveles(d, [AREAS[4]]));
  dibujar('promedios', $('#g-promedios'), cfgPromedios(d));
}

// ============================================================
//  4. Gráficos
// ============================================================

const TIPOS_GRAFICO = [
  ['promedios', 'Promedio por área'],
  ['histograma', 'Distribución de puntajes (histograma)'],
  ['niveles', 'Niveles de desempeño de un área'],
  ['grupos', 'Promedio por colegio, año, jornada…'],
  ['evolucion', 'Evolución por año'],
  ['dispersion', 'Dispersión entre dos pruebas'],
];

const EXPLICACIONES = {
  promedios: 'Compara el promedio de las cinco áreas. Todas usan la escala de 0 a 100.',
  histograma: 'Muestra cuántos estudiantes hay en cada rango de puntaje. Sirve para ver si la mayoría está agrupada, dispersa o si hay dos grupos distintos.',
  niveles: 'Porcentaje de estudiantes en cada nivel de desempeño del ICFES para el área elegida.',
  grupos: 'Promedio de la prueba elegida para cada grupo, ordenado de mayor a menor.',
  evolucion: 'Cómo cambia el promedio de un año a otro. Necesita datos de al menos dos años.',
  dispersion: 'Cada punto es un estudiante. Si los puntos forman una línea que sube, las dos pruebas están relacionadas. La recta roja muestra la tendencia.',
};

function renderGraficos() {
  const cont = $('#tab-graficos');
  const d = filtrados();
  if (!d.length) { cont.innerHTML = vacio(); return; }
  const u = estado.ui.grafico;
  const dims = dimensionesDisponibles(d).map((x) => [x.clave, x.nombre]);
  if (!dims.some(([k]) => k === u.dim) && dims.length) u.dim = dims[0][0];
  let controles = selector('grafico.tipo', u.tipo, TIPOS_GRAFICO, 'Tipo de gráfico');
  if (['histograma', 'grupos'].includes(u.tipo)) controles += selector('grafico.puntaje', u.puntaje, listaPuntajes(), 'Prueba');
  if (u.tipo === 'niveles') controles += selector('grafico.area', u.area, listaPuntajes(false), 'Área');
  if (u.tipo === 'grupos') controles += selector('grafico.dim', u.dim, dims, 'Agrupar por');
  if (u.tipo === 'evolucion') {
    controles += selector('grafico.serie', u.serie, [['areas', 'Una línea por área'], ...dims.filter(([k]) => k !== 'anio').map(([k, n]) => [k, `Una línea por ${n.toLowerCase()}`])], 'Series');
    if (u.serie !== 'areas') controles += selector('grafico.puntaje', u.puntaje, listaPuntajes(), 'Prueba');
  }
  if (u.tipo === 'dispersion') {
    controles += selector('grafico.x', u.x, listaPuntajes(), 'Eje horizontal (X)');
    controles += selector('grafico.y', u.y, listaPuntajes(), 'Eje vertical (Y)');
  }
  const pocosAnios = u.tipo === 'evolucion' && valores(d, 'anio').filter((v) => v !== '').length < 2;
  cont.innerHTML = `<div class="tarjeta"><h2>Gráficos</h2>
    <div class="fila-controles">${controles}</div>
    <p class="nota">${EXPLICACIONES[u.tipo]}</p>
    ${pocosAnios ? '<div class="alerta aviso">Hay un solo año en los datos filtrados. Cargue archivos de varios años (o quite el filtro de año) para ver la evolución.</div>' : ''}
    <div class="grafico" id="g-principal"></div>
    <div class="fila-botones"><button class="btn secundario" id="btn-png">Descargar imagen (PNG)</button></div></div>`;
  const cfg = {
    promedios: () => cfgPromedios(d),
    histograma: () => cfgHistograma(d, puntaje(u.puntaje)),
    niveles: () => cfgNivelesArea(d, puntaje(u.area)),
    grupos: () => cfgGrupos(d, u.dim, puntaje(u.puntaje)),
    evolucion: () => cfgEvolucion(d, u.serie, puntaje(u.puntaje)),
    dispersion: () => cfgDispersion(d, puntaje(u.x), puntaje(u.y)),
  }[u.tipo]();
  dibujar('principal', $('#g-principal'), cfg);
}

// ============================================================
//  5. Comparar
// ============================================================

function renderComparar() {
  const cont = $('#tab-comparar');
  const d = filtrados();
  if (!d.length) { cont.innerHTML = vacio(); return; }
  const u = estado.ui.comparar;
  const dims = dimensionesDisponibles(d).map((x) => [x.clave, x.nombre]);
  const primera = (k) => (dims.some(([c]) => c === k) ? k : dims[0]?.[0]);
  u.dim = primera(u.dim); u.filas = primera(u.filas); u.columnas = primera(u.columnas); u.dimPrueba = primera(u.dimPrueba);
  if (!dims.length) { cont.innerHTML = '<div class="tarjeta"><div class="alerta aviso">Los datos no tienen columnas para agrupar (año, colegio, jornada, género…). Asígnelas en el paso 1.</div></div>'; return; }

  const gruposPrueba = valores(d, u.dimPrueba).map((v) => [String(v), etiqueta(u.dimPrueba, v)]);
  if (!gruposPrueba.some(([v]) => v === u.a)) u.a = gruposPrueba[0]?.[0] ?? '';
  if (!gruposPrueba.some(([v]) => v === u.b) || u.b === u.a) u.b = gruposPrueba.find(([v]) => v !== u.a)?.[0] ?? '';

  const p = puntaje(u.puntajePrueba);
  const grupoA = d.filter((r) => String(r[u.dimPrueba]) === u.a), grupoB = d.filter((r) => String(r[u.dimPrueba]) === u.b);
  const w = Est.welch(col(grupoA, p.clave), col(grupoB, p.clave));
  let resultado = '<div class="alerta aviso">Se necesitan al menos 2 estudiantes con puntaje en cada grupo.</div>';
  if (w) {
    const sig = w.p < 0.05;
    const nombreA = etiqueta(u.dimPrueba, u.a), nombreB = etiqueta(u.dimPrueba, u.b);
    resultado = `<div class="resultado-prueba">
        <div class="cifra"><div class="valor">${fmt(w.a.media)}</div><div class="rotulo">${esc(nombreA)} (n = ${w.a.n})</div></div>
        <div class="cifra"><div class="valor">${fmt(w.b.media)}</div><div class="rotulo">${esc(nombreB)} (n = ${w.b.n})</div></div>
        <div class="cifra"><div class="valor">${w.diferencia > 0 ? '+' : ''}${fmt(w.diferencia)}</div><div class="rotulo">Diferencia</div></div>
        <div class="cifra"><div class="valor">${fmtP(w.p)}</div><div class="rotulo">Valor p (t de Welch = ${fmt(w.t, 2)})</div></div>
        <div class="cifra"><div class="valor">${fmt(w.d, 2)}</div><div class="rotulo">Tamaño del efecto (d de Cohen)</div></div></div>
      <div class="alerta ${sig ? 'ok' : 'info'}"><strong>Interpretación:</strong> ${sig
        ? `la diferencia de ${fmt(Math.abs(w.diferencia))} puntos en ${esc(p.nombre)} entre ${esc(nombreA)} y ${esc(nombreB)} <strong>es estadísticamente significativa</strong> (p < 0,05): es poco probable que se deba al azar.`
        : `la diferencia de ${fmt(Math.abs(w.diferencia))} puntos <strong>no es estadísticamente significativa</strong> (p ≥ 0,05): podría deberse al azar.`}
        El tamaño del efecto es <strong>${tamanoEfecto(w.d)}</strong>.</div>`;
  }

  cont.innerHTML = `
    <div class="tarjeta"><h2>Comparar grupos</h2>
      <div class="fila-controles">${selector('comparar.dim', u.dim, dims, 'Comparar por')}</div>
      ${htmlComparacion(d, u.dim)}
      <div class="grafico" id="g-comparar"></div></div>
    <div class="tarjeta"><h2>Tabla cruzada (por ejemplo: colegio × año)</h2>
      <div class="fila-controles">${selector('comparar.filas', u.filas, dims, 'Filas')}${selector('comparar.columnas', u.columnas, dims, 'Columnas')}${selector('comparar.metrica', u.metrica, listaPuntajes(), 'Prueba')}</div>
      ${u.filas === u.columnas ? '<div class="alerta aviso">Elija variables distintas para filas y columnas.</div>' : htmlCruzada(d, u.filas, u.columnas, puntaje(u.metrica)) + '<div class="grafico" id="g-cruzada"></div>'}</div>
    <div class="tarjeta"><h2>¿La diferencia entre dos grupos es real o puede ser azar?</h2>
      <p class="nota">Prueba t de Welch: compara los promedios de dos grupos teniendo en cuenta cuántos estudiantes hay y qué tan dispersos son sus puntajes.</p>
      <div class="fila-controles">${selector('comparar.dimPrueba', u.dimPrueba, dims, 'Variable')}${selector('comparar.a', u.a, gruposPrueba, 'Grupo A')}${selector('comparar.b', u.b, gruposPrueba, 'Grupo B')}${selector('comparar.puntajePrueba', u.puntajePrueba, listaPuntajes(), 'Prueba')}</div>
      ${resultado}</div>`;
  dibujar('comparar', $('#g-comparar'), cfgComparacionAreas(d, u.dim));
  if (u.filas !== u.columnas) dibujar('cruzada', $('#g-cruzada'), cfgCruzada(d, u.filas, u.columnas, puntaje(u.metrica)));
}

// ============================================================
//  6. Correlaciones
// ============================================================

function renderCorrelaciones() {
  const cont = $('#tab-correlaciones');
  const d = filtrados();
  if (!d.length) { cont.innerHTML = vacio(); return; }
  const u = estado.ui.corr;
  const niveles = [['estudiantes', 'Estudiantes (cada fila es un estudiante)']];
  if (valores(d, 'colegio').filter((v) => v !== '').length >= 3) niveles.push(['colegio', 'Promedios por colegio']);
  if (valores(d, 'colegio').filter((v) => v !== '').length * valores(d, 'anio').filter((v) => v !== '').length >= 3) niveles.push(['colegio_anio', 'Promedios por colegio y año']);
  if (!niveles.some(([k]) => k === u.nivel)) u.nivel = 'estudiantes';
  const filas = datosCorrelacion(d, u.nivel);
  const matriz = matrizCorrelacion(filas, u.metodo);
  const px = puntaje(u.x), py = puntaje(u.y);
  const c = u.x === u.y ? null : Est.correlacion(col(filas, u.x), col(filas, u.y), u.metodo);
  let detalle = '<div class="alerta aviso">Elija dos pruebas distintas (haga clic en una celda de la tabla).</div>';
  if (c) {
    detalle = `<div class="resultado-prueba">
      <div class="cifra"><div class="valor">${fmt(c.r, 2)}</div><div class="rotulo">Coeficiente r (${u.metodo === 'spearman' ? 'Spearman' : 'Pearson'})</div></div>
      <div class="cifra"><div class="valor">${fmt(c.r2 * 100)}%</div><div class="rotulo">Variación compartida (r²)</div></div>
      <div class="cifra"><div class="valor">${fmtP(c.p)}</div><div class="rotulo">Valor p</div></div>
      <div class="cifra"><div class="valor">${c.n}</div><div class="rotulo">${u.nivel === 'estudiantes' ? 'Estudiantes' : 'Grupos'}</div></div></div>
      <div class="alerta info"><strong>Interpretación:</strong> la relación entre ${esc(px.nombre)} y ${esc(py.nombre)} es <strong>${fuerza(c.r)}</strong> y ${c.r >= 0 ? 'positiva (cuando una sube, la otra tiende a subir)' : 'negativa (cuando una sube, la otra tiende a bajar)'}${c.p < 0.05 ? ' y estadísticamente significativa' : ', pero no estadísticamente significativa'}.
      Recta de tendencia: ${esc(py.corto)} ≈ ${fmt(c.intercepto, 2)} ${c.pendiente >= 0 ? '+' : '−'} ${fmt(Math.abs(c.pendiente), 3)} × ${esc(px.corto)}.
      Recuerde: correlación no significa que una cosa cause la otra.</div>`;
  }
  cont.innerHTML = `<div class="tarjeta"><h2>Correlaciones entre pruebas</h2>
      <p class="nota">El coeficiente r va de −1 a 1. Cerca de 1: las dos pruebas suben juntas. Cerca de 0: no hay relación. Negativo: cuando una sube, la otra baja.
        Haga clic en una celda para ver su gráfico.</p>
      <div class="fila-controles">${selector('corr.nivel', u.nivel, niveles, 'Nivel de análisis')}${selector('corr.metodo', u.metodo, [['pearson', 'Pearson (relación lineal)'], ['spearman', 'Spearman (por rangos, resiste valores extremos)']], 'Método')}</div>
      ${htmlMatriz(matriz, [u.x, u.y])}</div>
    <div class="tarjeta"><h2>Detalle de un par</h2>
      <div class="fila-controles">${selector('corr.x', u.x, listaPuntajes(), 'Prueba X')}${selector('corr.y', u.y, listaPuntajes(), 'Prueba Y')}</div>
      ${detalle}
      <div class="grafico" id="g-dispersion"></div>
      <div class="fila-botones"><button class="btn secundario" id="btn-png-disp">Descargar imagen (PNG)</button></div></div>`;
  dibujar('dispersion', $('#g-dispersion'), cfgDispersion(filas, px, py, u.metodo, u.nivel === 'estudiantes' ? null : (r) => r.etiqueta));
}

// ============================================================
//  7. Informe
// ============================================================

// El informe estructurado está en js/informe.js (renderInforme, generarInforme).

function exportarExcel() {
  const d = filtrados();
  const wb = XLSX.utils.book_new();
  const hoja = (nombre, filas) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas.length ? filas : [{}]), nombre.slice(0, 31));
  hoja('Descriptivas', PUNTAJES.map((p) => {
    const r = Est.resumen(col(d, p.clave));
    return { Prueba: p.nombre, N: r.n, Promedio: redondear(r.media), 'IC 95% ±': redondear(r.ic95), Mediana: redondear(r.mediana), 'Desv. estándar': redondear(r.de),
      Mínimo: r.min, Q1: redondear(r.q1), Q3: redondear(r.q3), Máximo: r.max, 'Coef. variación %': redondear(r.cv) };
  }));
  hoja('Niveles', AREAS.flatMap((a) => distribucionNiveles(d, a).niveles.map((n) => ({ Área: a.nombre, Nivel: n.nivel, Estudiantes: n.n, Porcentaje: redondear(n.pct) }))));
  for (const dim of dimensionesDisponibles(d)) {
    if (valores(d, dim.clave).length < 2) continue;
    hoja(`Por ${dim.nombre.replace(/[\\/?*[\]:]/g, '-')}`, agrupar(d, dim.clave).map((g) => {
      const o = { [dim.nombre]: etiqueta(dim.clave, g.clave), N: g.filas.length };
      for (const p of PUNTAJES) o[p.nombre] = redondear(Est.media(col(g.filas, p.clave)));
      return o;
    }));
  }
  const m = matrizCorrelacion(d, 'pearson');
  hoja('Correlaciones', PUNTAJES.map((a, i) => ({ Prueba: a.nombre, ...Object.fromEntries(PUNTAJES.map((b, j) => [b.corto, redondear(m[i][j]?.r, 3)])) })));
  hoja('Conclusiones', conclusiones(d).map((c) => ({ Conclusión: c.replace(/<[^>]+>/g, '') })));
  hoja('Datos filtrados', filasLegibles(d));
  descargarLibro(wb, 'saber11_estadisticas.xlsx');
}

// ============================================================
//  Eventos
// ============================================================

function asignarUI(ruta, valor) {
  const [grupo, campo] = ruta.split('.');
  estado.ui[grupo][campo] = valor;
}

document.addEventListener('DOMContentLoaded', () => {
  $('#pestanas').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b && !b.disabled) mostrar(b.dataset.tab);
  });

  const entrada = $('#entrada-archivos');
  entrada.addEventListener('change', () => { agregarArchivos([...entrada.files]); entrada.value = ''; });
  const zona = $('#zona-carga');
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('encima'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
  zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('encima'); agregarArchivos([...e.dataTransfer.files]); });

  $('#btn-ejemplo').addEventListener('click', () => {
    const ej = Datos.generarEjemplo();
    estado.archivos = estado.archivos.filter((a) => a.nombre !== ej.nombre);
    estado.archivos.push(Datos.prepararArchivo(ej.nombre, ej.hojas));
    estado.desactualizado = true;
    renderCargar();
    avisar('Se cargaron datos ficticios de 3 colegios y 3 años (con errores a propósito para probar la limpieza).');
  });
  $('#btn-descargar-ejemplo').addEventListener('click', () => descargarLibro(Datos.libroEjemplo(), 'ejemplo_saber11_ficticio.xlsx'));

  $('#lista-archivos').addEventListener('change', alCambiarArchivo);
  $('#lista-archivos').addEventListener('click', (e) => {
    if (e.target.dataset.accion !== 'quitar') return;
    const a = archivoDe(e.target);
    estado.archivos = estado.archivos.filter((x) => x !== a);
    estado.desactualizado = true;
    renderCargar();
  });

  $('#filtros').addEventListener('change', (e) => {
    const k = e.target.dataset.filtro;
    if (!k) return;
    estado.filtros[k] = e.target.value;
    renderFiltros();
    render();
  });

  document.body.addEventListener('click', (e) => {
    const t = e.target;
    const ir = t.closest('[data-ir]');
    if (ir) { mostrar(ir.dataset.ir); return; }
    if (t.id === 'btn-procesar') procesarDatos();
    else if (t.id === 'btn-descargar-limpios') descargarDatosLimpios();
    else if (t.id === 'btn-quitar-filtros') { Object.keys(estado.filtros).forEach((k) => { estado.filtros[k] = ''; }); renderFiltros(); render(); }
    else if (t.id === 'btn-png') descargarGrafico('principal', 'grafico_saber11');
    else if (t.id === 'btn-png-disp') descargarGrafico('dispersion', 'correlacion_saber11');
    else if (t.id === 'btn-generar') generarInforme();
    else if (t.id === 'btn-imprimir') { if (!$('#informe-doc').innerHTML.trim()) generarInforme(); setTimeout(() => window.print(), 100); }
    else if (t.dataset.accionGlobal === 'excel') exportarExcel();
    else if (t.closest('.matriz td[data-x]')) {
      const td = t.closest('td');
      estado.ui.corr.x = td.dataset.x; estado.ui.corr.y = td.dataset.y;
      renderCorrelaciones();
    }
  });

  document.body.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.opcion) { estado.opciones[t.dataset.opcion] = t.checked; estado.desactualizado = true; }
    else if (t.dataset.ui) { asignarUI(t.dataset.ui, t.value); render(); }
    else if (t.dataset.seccion) estado.ui.informe.secciones[t.dataset.seccion] = t.checked;

    else if (t.dataset.informe) { estado.ui.informe[t.dataset.informe] = t.value; if (t.tagName === 'SELECT') renderInforme(); }
  });
  document.body.addEventListener('input', (e) => {
    if (e.target.dataset.informe && e.target.tagName !== 'SELECT') estado.ui.informe[e.target.dataset.informe] = e.target.value;
  });

  renderCargar();
});
