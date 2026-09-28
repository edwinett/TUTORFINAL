'use strict';

// ============================================================
//  Informe estructurado "Análisis de resultados examen Saber 11°"
//  Sigue el modelo de referencia: contexto y hallazgos, 1. puntajes promedio,
//  2. brechas educativas, 3. niveles de desempeño, 4. resultados por territorio,
//  5. conclusiones y anexos. Cada apartado se omite si los datos no lo permiten.
// ============================================================

const SECCIONES_INFORME = [
  ['contexto', 'Contexto y hallazgos'],
  ['promedios', '1. Puntajes promedio'],
  ['brechas', '2. Brechas educativas'],
  ['niveles', '3. Niveles de desempeño'],
  ['territorios', '4. Resultados por territorio'],
  ['conclusiones', '5. Conclusiones'],
  ['anexos', 'Anexos'],
];

const UNIDADES_TERRITORIO = ['departamento', 'etc', 'municipio', 'colegio'];

// --- utilidades del informe ---
const signo = (v, d = 1) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const r = Math.round(v * 10 ** d) / 10 ** d;
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${fmt(Math.abs(r), d)}`;
};
const pctCambio = (a, b) => (a && Number.isFinite(a) && Number.isFinite(b) ? ((b - a) / a) * 100 : null);
const unirY = (lista) => (lista.length <= 1 ? lista.join('') : `${lista.slice(0, -1).join(', ')} y ${lista.at(-1)}`);
const mediaDe = (filas, clave = 'global') => Est.media(col(filas, clave));
const gruposDe = (d, dim) => valores(d, dim).filter((v) => v !== '');
const nombreDim = (dim) => dimension(dim).nombre.toLowerCase();
const verbo = (v, sube = 'aumentó', baja = 'disminuyó', igual = 'se mantuvo') => (v > 0.05 ? sube : v < -0.05 ? baja : igual);

function colorDe(dim, v, i) {
  return COLORES_CATEGORIA[v] || (dim === 'nse' ? COLORES_CATEGORIA[`NSE${i + 1}`] : null) || COLORES_GRUPO[i % COLORES_GRUPO.length];
}

// Etiquetas de texto junto a los puntos de los gráficos de dispersión del informe.
Chart.register({
  id: 'etiquetasPuntos',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((ds, i) => {
      if (!ds.etiquetar) return;
      const meta = chart.getDatasetMeta(i);
      ctx.save();
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = '#334155';
      meta.data.forEach((pt, j) => {
        const txt = ds.data[j]?.etiqueta;
        if (txt) ctx.fillText(txt.length > 24 ? txt.slice(0, 23) + '…' : txt, pt.x + 6, pt.y - 5);
      });
      ctx.restore();
    });
  },
});

function contextoInforme(datos, u) {
  const anios = gruposDe(datos, 'anio');
  if (!anios.length) return { anios, anioA: null, anioB: null, rango: [], d: datos, A: datos, B: [] };
  const anioA = anios.includes(Number(u.anio)) ? Number(u.anio) : anios.at(-1);
  const previos = anios.filter((a) => a < anioA);
  const anioB = previos.includes(Number(u.comparacion)) ? Number(u.comparacion) : previos.at(-1) ?? null;
  const rango = anios.filter((a) => a <= anioA).slice(-5);
  const d = datos.filter((r) => rango.includes(r.anio));
  return { anios, anioA, anioB, rango, d, A: d.filter((r) => r.anio === anioA), B: anioB == null ? [] : datos.filter((r) => r.anio === anioB) };
}

function rangoTexto(ctx) { return ctx.rango.length > 1 ? `${ctx.rango[0]}-${ctx.rango.at(-1)}` : String(ctx.anioA ?? ''); }

// ------------------------------------------------------------
//  Configuraciones de gráficos propias del informe
// ------------------------------------------------------------

function cfgGlobalEvaluados(ctx) {
  const por = ctx.rango.map((y) => ctx.d.filter((r) => r.anio === y));
  return {
    type: 'bar',
    data: {
      labels: ctx.rango.map(String),
      datasets: [
        { type: 'line', label: 'Puntaje global promedio', data: por.map((f) => redondear(mediaDe(f), 1)), borderColor: '#1e3a8a', backgroundColor: '#1e3a8a', yAxisID: 'y', tension: 0.2, pointRadius: 5 },
        { type: 'bar', label: 'Estudiantes evaluados', data: por.map((f) => f.length), backgroundColor: 'rgba(148, 163, 184, .55)', yAxisID: 'y1' },
      ],
    },
    options: {
      plugins: { title: titulo('Puntaje global promedio y número de evaluados') },
      scales: {
        y: { position: 'left', title: ejeTitulo('Puntaje global (0–500)') },
        y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: ejeTitulo('Evaluados') },
      },
    },
  };
}

function cfgLineasPorGrupo(ctx, dim, clave = 'global') {
  const grupos = gruposDe(ctx.d, dim);
  return {
    type: 'line',
    data: {
      labels: ctx.rango.map(String),
      datasets: grupos.map((g, i) => ({
        label: etiqueta(dim, g), borderColor: colorDe(dim, g, i), backgroundColor: colorDe(dim, g, i), tension: 0.2, pointRadius: 4,
        data: ctx.rango.map((y) => redondear(mediaDe(ctx.d.filter((r) => r.anio === y && r[dim] === g), clave), 1)),
      })),
    },
    options: {
      spanGaps: true,
      plugins: { title: titulo(`${puntaje(clave).nombre} promedio por ${nombreDim(dim)}`) },
      scales: { y: { title: ejeTitulo('Puntaje promedio') } },
    },
  };
}

function cfgBarrasPorGrupo(filas, dim, tituloTxt) {
  const grupos = gruposDe(filas, dim);
  return {
    type: 'bar',
    data: {
      labels: grupos.map((g) => etiqueta(dim, g)),
      datasets: [{ label: 'Puntaje global', data: grupos.map((g) => redondear(mediaDe(filas.filter((r) => r[dim] === g)), 1)), backgroundColor: grupos.map((g, i) => colorDe(dim, g, i)) }],
    },
    options: { plugins: { title: titulo(tituloTxt), legend: { display: false } }, scales: { y: { beginAtZero: true, title: ejeTitulo('Puntaje global promedio') } } },
  };
}

function cfgConteoCruzado(filas, dimA, dimB, tituloTxt) {
  const ga = gruposDe(filas, dimA), gb = gruposDe(filas, dimB);
  return {
    type: 'bar',
    data: {
      labels: ga.map((g) => etiqueta(dimA, g)),
      datasets: gb.map((b, i) => ({ label: etiqueta(dimB, b), backgroundColor: colorDe(dimB, b, i), data: ga.map((a) => filas.filter((r) => r[dimA] === a && r[dimB] === b).length) })),
    },
    options: { plugins: { title: titulo(tituloTxt) }, scales: { y: { beginAtZero: true, title: ejeTitulo('Estudiantes') } } },
  };
}

function cfgNivelesPorAnio(ctx, area) {
  const nombres = area.niveles.map((n) => n.nombre);
  const dist = ctx.rango.map((y) => distribucionNiveles(ctx.d.filter((r) => r.anio === y), area));
  return {
    type: 'bar',
    data: {
      labels: ctx.rango.map(String),
      datasets: nombres.map((nv, i) => ({ label: area.clave === 'ingles' ? nv : `Nivel ${nv}`, backgroundColor: COLORES_NIVEL[nv], data: dist.map((x) => redondear(x.niveles[i].pct, 1)) })),
    },
    options: {
      indexAxis: 'y',
      plugins: { title: titulo(`${area.nombre}: % de estudiantes por nivel de desempeño`) },
      scales: { x: { stacked: true, max: 100, title: ejeTitulo('% de estudiantes') }, y: { stacked: true } },
    },
  };
}

function cfgNivelesPorNSE(filas, area) {
  const grupos = gruposDe(filas, 'nse');
  const nombres = area.niveles.map((n) => n.nombre);
  const dist = grupos.map((g) => distribucionNiveles(filas.filter((r) => r.nse === g), area));
  return {
    type: 'bar',
    data: {
      labels: grupos.map((g) => etiqueta('nse', g)),
      datasets: nombres.map((nv, i) => ({ label: area.clave === 'ingles' ? nv : `Nivel ${nv}`, backgroundColor: COLORES_NIVEL[nv], data: dist.map((x) => redondear(x.niveles[i].pct, 1)) })),
    },
    options: {
      indexAxis: 'y',
      plugins: { title: titulo(`${area.nombre}: niveles de desempeño por NSE`) },
      scales: { x: { stacked: true, max: 100, title: ejeTitulo('% de estudiantes') }, y: { stacked: true } },
    },
  };
}

function cfgBarrasTerritorio(items, tituloTxt, valor, colorFn, eje) {
  return {
    type: 'bar',
    data: { labels: items.map((t) => t.nombre), datasets: [{ label: eje, data: items.map((t) => redondear(valor(t), 1)), backgroundColor: items.map(colorFn) }] },
    options: { indexAxis: 'y', plugins: { title: titulo(tituloTxt), legend: { display: false } }, scales: { x: { title: ejeTitulo(eje) }, y: { ticks: { autoSkip: false, font: { size: 11 } } } } },
  };
}

function cfgAcumuladoPorPrueba(items) {
  return {
    type: 'bar',
    data: {
      labels: items.map((t) => t.nombre),
      datasets: AREAS.map((a) => ({
        label: a.nombre, backgroundColor: a.color,
        data: items.map((t) => redondear((mediaDe(t.filas, a.clave) ?? 0) * (a.clave === 'ingles' ? 1 : 3) / 13 * 5, 1)),
      })),
    },
    options: {
      indexAxis: 'y',
      plugins: { title: titulo('Aporte de cada prueba al puntaje global promedio') },
      scales: { x: { stacked: true, title: ejeTitulo('Puntaje global (0–500)') }, y: { stacked: true, ticks: { autoSkip: false, font: { size: 11 } } } },
    },
  };
}

function cfgTerritorioPorGrupo(items, dim, tituloTxt) {
  const grupos = gruposDe(items.flatMap((t) => t.filas), dim);
  return {
    type: 'bar',
    data: {
      labels: items.map((t) => t.nombre),
      datasets: grupos.map((g, i) => ({ label: etiqueta(dim, g), backgroundColor: colorDe(dim, g, i), data: items.map((t) => redondear(mediaDe(t.filas.filter((r) => r[dim] === g)), 1)) })),
    },
    options: { indexAxis: 'y', plugins: { title: titulo(tituloTxt) }, scales: { x: { title: ejeTitulo('Puntaje global promedio') }, y: { ticks: { autoSkip: false, font: { size: 11 } } } } },
  };
}

function cfgDispersionTerritorios(puntos, tituloTxt, ejeX, ejeY, diagonal) {
  const datasets = [{ label: 'Territorios', data: puntos, backgroundColor: 'rgba(37, 99, 235, .7)', pointRadius: 5, etiquetar: true }];
  if (diagonal && puntos.length) {
    const vals = puntos.flatMap((p) => [p.x, p.y]);
    const lo = Math.floor(Math.min(...vals) - 5), hi = Math.ceil(Math.max(...vals) + 5);
    datasets.push({ type: 'line', label: 'Sin brecha', data: [{ x: lo, y: lo }, { x: hi, y: hi }], borderColor: '#dc2626', borderWidth: 2, pointRadius: 0 });
  }
  return {
    type: 'scatter',
    data: { datasets },
    options: { plugins: { title: titulo(tituloTxt) }, scales: { x: { title: ejeTitulo(ejeX) }, y: { title: ejeTitulo(ejeY) } } },
  };
}

// ------------------------------------------------------------
//  Tablas del informe
// ------------------------------------------------------------

function tablaHtml(cabeza, filas) {
  return `<div class="tabla-envoltura"><table><thead><tr>${cabeza.map((c, i) => `<th${i === 0 ? ' class="texto"' : ''}>${c}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f) => `<tr>${f.map((c, i) => `<td${i === 0 ? ' class="texto"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const claseSigno = (v) => (v > 0 ? 'positivo' : v < 0 ? 'negativo' : '');
const celdaSigno = (v, d = 1, sufijo = '') => `<span class="${claseSigno(v)}">${signo(v, d)}${v == null || !Number.isFinite(v) ? '' : sufijo}</span>`;

// Tabla de doble entrada con diferencias absolutas, como la de "Brechas por zona y sector".
function tabla2x2(filas, dimF, dimC) {
  const gf = gruposDe(filas, dimF), gc = gruposDe(filas, dimC);
  const m = gf.map((f) => gc.map((c) => mediaDe(filas.filter((r) => r[dimF] === f && r[dimC] === c))));
  const cuerpo = gf.map((f, i) => [esc(etiqueta(dimF, f)), ...m[i].map((v) => fmt(v)), gc.length === 2 ? `<strong>${fmt(m[i][0] != null && m[i][1] != null ? Math.abs(m[i][0] - m[i][1]) : null)}</strong>` : '']);
  if (gf.length === 2) cuerpo.push(['<strong>Diferencia absoluta</strong>', ...gc.map((_, j) => `<strong>${fmt(m[0][j] != null && m[1][j] != null ? Math.abs(m[0][j] - m[1][j]) : null)}</strong>`), '']);
  return { html: tablaHtml(['', ...gc.map((c) => esc(etiqueta(dimC, c))), gc.length === 2 ? 'Diferencia absoluta' : ''], cuerpo), m, gf, gc };
}

// ------------------------------------------------------------
//  Construcción del informe
// ------------------------------------------------------------

function nuevoInforme() {
  const toc = [];
  let seccion = 0, letra = 0;
  return {
    toc,
    seccion(tituloTxt, clave) {
      seccion++; letra = 0;
      toc.push({ nivel: 1, texto: `${seccion}. ${tituloTxt}`, id: `inf-${clave}` });
      return `<div class="banda" id="inf-${clave}">${seccion}. ${esc(tituloTxt.toUpperCase())}</div>`;
    },
    sub(tituloTxt, cuerpo) {
      const l = String.fromCharCode(65 + letra++);
      toc.push({ nivel: 2, texto: `${l}. ${tituloTxt}` });
      return `<article class="sub"><h3><span class="letra">${l}.</span> ${esc(tituloTxt)}</h3>${cuerpo}</article>`;
    },
  };
}

const destacado = (grande, pequeno) => `<div class="destacado"><div class="grande">${grande}</div>${pequeno ? `<div class="pequeno">${pequeno}</div>` : ''}</div>`;
const puntos = (lista) => (lista.filter(Boolean).length ? `<ul class="puntos">${lista.filter(Boolean).map((x) => `<li>${x}</li>`).join('')}</ul>` : '');
const nota = (t) => `<p class="nota-inf"><strong>Nota:</strong> ${t}</p>`;
const imagen = (cfg, alto = 360) => `<img src="${imagenDe(cfg, 900, alto)}" alt="">`;

// Brecha entre los dos grupos principales de una variable (p. ej. no oficial − oficial).
function brechaDe(filas, dim, alto, bajo) {
  const a = mediaDe(filas.filter((r) => r[dim] === alto)), b = mediaDe(filas.filter((r) => r[dim] === bajo));
  return a != null && b != null ? a - b : null;
}

const PARES_BRECHA = {
  nse: ['NSE4', 'NSE1', 'la brecha entre el NSE 4 (el más alto) y el NSE 1 (el más bajo)'],
  naturaleza: ['NO OFICIAL', 'OFICIAL', 'la brecha entre el sector no oficial y el oficial'],
  zona: ['URBANO', 'RURAL', 'la brecha entre la zona urbana y la rural'],
  genero: ['M', 'F', 'la brecha entre hombres y mujeres'],
};

function subPorGrupo(ctx, inf, dim, tituloTxt) {
  const grupos = gruposDe(ctx.d, dim);
  const tieneB = ctx.B.length && ctx.anioB != null;
  const filas = grupos.map((g) => {
    const enA = ctx.A.filter((r) => r[dim] === g), enB = ctx.B.filter((r) => r[dim] === g);
    const mA = mediaDe(enA), mB = mediaDe(enB);
    return { g, mA, mB, nA: enA.length, nB: enB.length, anual: ctx.rango.map((y) => mediaDe(ctx.d.filter((r) => r.anio === y && r[dim] === g))) };
  });
  const tabla = tablaHtml(
    [esc(dimension(dim).nombre), ...ctx.rango.map(String), tieneB ? `Variación ${ctx.anioB}–${ctx.anioA}` : null, `Evaluados ${ctx.anioA ?? ''}`, tieneB ? 'Variación evaluados' : null].filter((x) => x != null),
    filas.map((f) => [esc(etiqueta(dim, f.g)), ...f.anual.map((v) => fmt(v)), tieneB ? celdaSigno(f.mA - f.mB) : null, f.nA.toLocaleString('es-CO'), tieneB ? celdaSigno(pctCambio(f.nB, f.nA), 1, '%') : null].filter((x) => x != null)),
  );
  const par = PARES_BRECHA[dim];
  const obs = [];
  if (tieneB) {
    obs.push(`Entre ${ctx.anioB} y ${ctx.anioA}, ${filas.map((f) => `${etiqueta(dim, f.g)} ${verbo(f.mA - f.mB, 'subió', 'bajó', 'se mantuvo')}${Math.abs(f.mA - f.mB) >= 0.05 ? ` ${fmt(Math.abs(f.mA - f.mB))} puntos` : ''}`).join('; ')}.`);
  }
  let grande = '';
  if (par && grupos.includes(par[0]) && grupos.includes(par[1])) {
    const bA = brechaDe(ctx.A, dim, par[0], par[1]);
    const bB = tieneB ? brechaDe(ctx.B, dim, par[0], par[1]) : null;
    if (bA != null) {
      const favor = bA >= 0 ? etiqueta(dim, par[0]) : etiqueta(dim, par[1]);
      obs.unshift(`En ${ctx.anioA ?? 'el periodo'}, ${par[2]} fue de <strong>${fmt(Math.abs(bA))} puntos</strong> a favor de ${favor.toLowerCase()}${bB != null ? `; frente a ${ctx.anioB} ${verbo(Math.abs(bA) - Math.abs(bB), 'se amplió', 'se redujo', 'se mantuvo')}${Math.abs(Math.abs(bA) - Math.abs(bB)) >= 0.05 ? ` en ${fmt(Math.abs(Math.abs(bA) - Math.abs(bB)))} puntos` : ''}` : ''}.`);
      grande = destacado(`${fmt(Math.abs(bA))} PUNTOS`, `de brecha en ${ctx.anioA ?? ''}`);
    }
  }
  if (tieneB) {
    const cambios = filas.filter((f) => f.nB).map((f) => `${etiqueta(dim, f.g).toLowerCase()} (${signo(pctCambio(f.nB, f.nA))}%)`);
    if (cambios.length) obs.push(`Número de evaluados frente a ${ctx.anioB}: ${cambios.join(', ')}.`);
  }
  const grafico = ctx.rango.length > 1 ? imagen(cfgLineasPorGrupo(ctx, dim), 320) : imagen(cfgBarrasPorGrupo(ctx.A, dim, `Puntaje global promedio por ${nombreDim(dim)}`), 300);
  return inf.sub(tituloTxt, `${grande}${puntos(obs)}${grafico}${tabla}${tieneB ? nota(`Las variaciones corresponden a la diferencia entre ${ctx.anioB} y ${ctx.anioA}.`) : ''}`);
}

function subConteo(ctx, inf, dimA, dimB, tituloTxt) {
  const ga = gruposDe(ctx.A, dimA), gb = gruposDe(ctx.A, dimB);
  const tieneB = ctx.B.length && ctx.anioB != null;
  const celdas = [];
  const cuerpo = ga.map((a) => [esc(etiqueta(dimA, a)), ...gb.map((b) => {
    const nA = ctx.A.filter((r) => r[dimA] === a && r[dimB] === b).length;
    const nB = tieneB ? ctx.B.filter((r) => r[dimA] === a && r[dimB] === b).length : 0;
    const v = tieneB ? pctCambio(nB, nA) : null;
    if (v != null) celdas.push({ a, b, v, dif: nA - nB });
    return `${nA.toLocaleString('es-CO')}${v != null ? ` <span class="nota">(${signo(v)}%)</span>` : ''}`;
  })]);
  const obs = [];
  if (celdas.length) {
    const orden = [...celdas].sort((x, y) => x.v - y.v);
    const peor = orden[0], mejor = orden.at(-1);
    if (peor.v < 0) obs.push(`La mayor reducción de evaluados frente a ${ctx.anioB} se dio en ${etiqueta(dimA, peor.a).toLowerCase()} – ${etiqueta(dimB, peor.b)} (${signo(peor.v)}%).`);
    if (mejor.v > 0) obs.push(`El mayor aumento se dio en ${etiqueta(dimA, mejor.a).toLowerCase()} – ${etiqueta(dimB, mejor.b)} (${signo(mejor.v)}%).`);
  }
  return inf.sub(tituloTxt, `${puntos(obs)}${imagen(cfgConteoCruzado(ctx.A, dimA, dimB, `Estudiantes evaluados en ${ctx.anioA ?? ''} por ${nombreDim(dimA)} y ${nombreDim(dimB)}`), 300)}
    ${tablaHtml([esc(dimension(dimA).nombre), ...gb.map((b) => esc(etiqueta(dimB, b)))], cuerpo)}${tieneB ? nota(`Entre paréntesis, la variación porcentual frente a ${ctx.anioB}.`) : ''}`);
}

function sub2x2(ctx, inf, dimF, dimC, tituloTxt) {
  const t = tabla2x2(ctx.A, dimF, dimC);
  const obs = [];
  if (t.gf.length === 2 && t.gc.length === 2 && t.m.flat().every((v) => v != null)) {
    const difCol = t.gc.map((_, j) => Math.abs(t.m[0][j] - t.m[1][j]));
    const difFila = t.gf.map((_, i) => Math.abs(t.m[i][0] - t.m[i][1]));
    const [j1, j0] = difCol[0] >= difCol[1] ? [0, 1] : [1, 0];
    const veces = difCol[j0] > 0 ? difCol[j1] / difCol[j0] : null;
    obs.push(`La diferencia entre ${t.gf.map((g) => etiqueta(dimF, g).toLowerCase()).join(' y ')} es de <strong>${fmt(difCol[j1])} puntos</strong> en ${etiqueta(dimC, t.gc[j1]).toLowerCase()} frente a ${fmt(difCol[j0])} puntos en ${etiqueta(dimC, t.gc[j0]).toLowerCase()}${veces && veces >= 1.5 ? ` (una brecha ${fmt(veces, 1)} veces mayor)` : ''}.`);
    obs.push(`Entre ${t.gc.map((g) => etiqueta(dimC, g).toLowerCase()).join(' y ')} la diferencia es de ${difFila.map((v, i) => `${fmt(v)} puntos en ${etiqueta(dimF, t.gf[i]).toLowerCase()}`).join(' y ')}.`);
  }
  return inf.sub(tituloTxt, `${puntos(obs)}${t.html}${nota(`Puntaje global promedio en ${ctx.anioA ?? 'el periodo'}.`)}`);
}

function secContexto(ctx, inf, u) {
  const nA = ctx.A.length, nB = ctx.B.length;
  const gA = Est.resumen(col(ctx.A, 'global')), gB = Est.resumen(col(ctx.B, 'global'));
  const colegios = gruposDe(ctx.A, 'colegio').length, municipios = gruposDe(ctx.A, 'municipio').length;
  const ctxItems = [
    'Monitorear y evaluar los aprendizajes de las y los jóvenes es fundamental para tomar decisiones que respondan a sus necesidades educativas. Los resultados del examen Saber 11° son la medida más utilizada para seguir la calidad de la educación media y su evolución entre cohortes.',
    'El examen se aplica a estudiantes de grado 11° y evalúa competencias en Matemáticas, Lectura Crítica, Ciencias Naturales, Sociales y Ciudadanas e Inglés.',
    `Este documento presenta un análisis de los resultados de la prueba Saber 11° ${ctx.anioA ? `para ${ctx.anioA}` : ''}. En este periodo se analizaron <strong>${nA.toLocaleString('es-CO')} estudiantes</strong>${colegios ? ` de ${colegios} ${colegios === 1 ? 'colegio' : 'colegios'}` : ''}${municipios > 1 ? ` ubicados en ${municipios} municipios` : ''}.`,
  ];
  if (nB && gA.n && gB.n) {
    const dG = gA.media - gB.media;
    const areas = AREAS.map((a) => ({ a, d: mediaDe(ctx.A, a.clave) - mediaDe(ctx.B, a.clave) })).filter((x) => Number.isFinite(x.d));
    ctxItems.push(`En ${ctx.anioA} el puntaje global promedio ${verbo(dG)} ${Math.abs(dG) >= 0.05 ? `en ${fmt(Math.abs(dG))} puntos ` : ''}respecto a ${ctx.anioB} (${fmt(dG / (gB.de || 1), 2)} desviaciones estándar). Por prueba: ${areas.map((x) => `${x.a.nombre} ${signo(x.d)}`).join(', ')}.${Math.abs(dG / (gB.de || 1)) < 0.2 ? ' Estas variaciones no representan un cambio sustantivo en los aprendizajes.' : ''}`);
    ctxItems.push(`El número de evaluados ${verbo(nA - nB)} en ${Math.abs(nA - nB).toLocaleString('es-CO')} estudiantes frente a ${ctx.anioB} (${signo(pctCambio(nB, nA))}%).`);
    if (gruposDe(ctx.A, 'nse').length > 1) {
      const bajos = (f) => f.filter((r) => r.nse === 'NSE1' || r.nse === 'NSE2').length;
      const altos = (f) => f.filter((r) => r.nse === 'NSE3' || r.nse === 'NSE4').length;
      const dBajos = bajos(ctx.A) - bajos(ctx.B), dAltos = altos(ctx.A) - altos(ctx.B);
      ctxItems.push(`Los NSE 1 y 2 ${verbo(dBajos, 'aumentaron', 'redujeron', 'mantuvieron')} su participación en ${Math.abs(dBajos).toLocaleString('es-CO')} estudiantes, mientras que los NSE 3 y 4 ${verbo(dAltos, 'sumaron', 'perdieron', 'mantuvieron')} ${Math.abs(dAltos).toLocaleString('es-CO')}.${dBajos < 0 && dAltos > 0 && dG > 0 ? ' Dado que un mayor nivel socioeconómico se asocia con puntajes más altos, parte del aumento del promedio puede deberse a cambios en la composición del grupo evaluado más que a mejoras en los aprendizajes.' : ''}`);
    }
    const brechas = [];
    for (const dim of ['genero', 'naturaleza', 'zona']) {
      const [alto, bajo] = PARES_BRECHA[dim];
      const bA = brechaDe(ctx.A, dim, alto, bajo), bB = brechaDe(ctx.B, dim, alto, bajo);
      if (bA != null && bB != null) brechas.push(`${{ genero: 'entre hombres y mujeres', naturaleza: 'entre sector no oficial y oficial', zona: 'entre zona urbana y rural' }[dim]} fue de ${fmt(Math.abs(bA))} puntos (${signo(Math.abs(bA) - Math.abs(bB))} frente a ${ctx.anioB})`);
    }
    if (brechas.length) ctxItems.push(`La brecha ${brechas.join('; la brecha ')}.`);
  }
  let html = `<div class="banda" id="inf-contexto">CONTEXTO</div><article class="sub">${puntos(ctxItems)}</article>`;
  inf.toc.push({ nivel: 1, texto: 'Contexto y hallazgos', id: 'inf-contexto' });

  const hall = [];
  const unidad = u.territorio;
  if (unidad) {
    const items = territorios(ctx.A, unidad).filter((t) => t.n >= 5);
    if (items.length >= 3) {
      const k = Math.min(5, Math.floor(items.length / 2));
      const lista = (arr) => arr.map((t) => `${esc(t.nombre)} (${fmt(t.media)})`).join(', ');
      hall.push(k === 1
        ? `El puntaje promedio más alto en ${ctx.anioA ?? 'el periodo'} fue el de ${lista(items.slice(0, 1))}.`
        : `Los ${k} ${nombresUnidad(unidad)} con los puntajes promedio más altos en ${ctx.anioA ?? 'el periodo'} fueron: ${lista(items.slice(0, k))}.`);
      hall.push(`En cambio, ${lista(items.slice(-k).reverse())} ${k === 1 ? 'presentó' : 'presentaron'} el mayor rezago.`);
    }
    if (ctx.B.length) {
      const vari = variaciones(ctx, unidad).filter((t) => t.nA >= 5 && t.nB >= 5);
      if (vari.length >= 3) {
        const k = Math.min(3, Math.floor(vari.length / 2));
        const orden = [...vari].sort((a, b) => b.v - a.v);
        hall.push(`Frente a ${ctx.anioB}, quienes más mejoraron fueron ${orden.slice(0, k).map((t) => `${esc(t.nombre)} (${signo(t.v)} puntos)`).join(', ')}; los que más disminuyeron fueron ${orden.slice(-k).reverse().map((t) => `${esc(t.nombre)} (${signo(t.v)})`).join(', ')}.`);
      }
    }
  }
  if (hall.length) html += `<div class="banda">HALLAZGOS</div><article class="sub">${puntos(hall)}</article>`;
  return html;
}

function secPromedios(ctx, inf) {
  let html = inf.seccion(`Puntajes promedio ${rangoTexto(ctx)}`, 'promedios');
  const gA = Est.resumen(col(ctx.A, 'global')), gB = Est.resumen(col(ctx.B, 'global'));
  const tieneB = ctx.B.length && gB.n;
  const dG = tieneB ? gA.media - gB.media : null;
  const filasTabla = ctx.rango.map((y, i) => {
    const f = ctx.d.filter((r) => r.anio === y);
    const prev = i ? ctx.d.filter((r) => r.anio === ctx.rango[i - 1]) : null;
    return [String(y), f.length.toLocaleString('es-CO'), fmt(mediaDe(f)), fmt(Est.resumen(col(f, 'global')).de), prev ? celdaSigno(mediaDe(f) - mediaDe(prev)) : '—'];
  });
  const obsA = [];
  if (tieneB) {
    obsA.push(`El puntaje global promedio pasó de ${fmt(gB.media)} en ${ctx.anioB} a <strong>${fmt(gA.media)}</strong> en ${ctx.anioA} (${signo(dG)} puntos; ${fmt(dG / (gB.de || 1), 2)} desviaciones estándar).`);
    const idx = ctx.rango.indexOf(ctx.anioB);
    if (idx > 0) {
      const antes = mediaDe(ctx.d.filter((r) => r.anio === ctx.rango[idx - 1]));
      const dPrev = gB.media - antes;
      if (Number.isFinite(dPrev)) obsA.push(`El cambio del año inmediatamente anterior (${ctx.rango[idx - 1]}–${ctx.anioB}) fue de ${signo(dPrev)} puntos.`);
    }
    const w = Est.welch(col(ctx.A, 'global'), col(ctx.B, 'global'));
    if (w) obsA.push(`La diferencia entre ${ctx.anioB} y ${ctx.anioA} ${w.p < 0.05 ? 'es' : 'no es'} estadísticamente significativa (p ${w.p < 0.001 ? '< 0,001' : '= ' + fmtP(w.p)}).`);
  } else if (gA.n) obsA.push(`El puntaje global promedio fue de <strong>${fmt(gA.media)}</strong> puntos (desviación estándar ${fmt(gA.de)}).`);
  html += inf.sub('Puntaje global y evaluados',
    `${tieneB ? destacado(`${signo(dG)} PUNTOS`, `(${signo(pctCambio(gB.media, gA.media))}%) DE ${ctx.anioB} A ${ctx.anioA}`) : destacado(`${fmt(gA.media)} PUNTOS`, `puntaje global promedio ${ctx.anioA ?? ''}`)}
     ${puntos(obsA)}${ctx.rango.length ? imagen(cfgGlobalEvaluados(ctx), 330) : ''}
     ${tablaHtml(['Año', 'Evaluados', 'Puntaje global', 'Desv. estándar', 'Variación anual'], filasTabla)}
     ${nota('El puntaje global (PG) agrega las cinco pruebas con la ponderación oficial: PG = [3 × (M + LC + CN + SC) + I] / 13 × 5, en escala de 0 a 500. El número de estudiantes corresponde a los registros cargados y limpios.')}`);

  const areas = AREAS.map((a) => ({ a, mA: mediaDe(ctx.A, a.clave), mB: mediaDe(ctx.B, a.clave), de: Est.resumen(col(ctx.B, a.clave)).de }));
  const mejoran = areas.filter((x) => x.mA - x.mB > 0.05);
  const bajan = areas.filter((x) => x.mA - x.mB < -0.05);
  const obsB = [];
  if (tieneB) {
    if (mejoran.length) obsB.push(`${mejoran.length === 1 ? 'La prueba' : `Las ${mejoran.length} pruebas`} ${mejoran.map((x) => `${x.a.nombre} (${signo(x.mA - x.mB)})`).join(', ')} ${mejoran.length === 1 ? 'mejoró' : 'mejoraron'} respecto a ${ctx.anioB}.`);
    if (bajan.length) obsB.push(`${bajan.map((x) => `${x.a.nombre} (${signo(x.mA - x.mB)})`).join(', ')} ${bajan.length === 1 ? 'presentó un decrecimiento' : 'presentaron un decrecimiento'} frente a ${ctx.anioB}.`);
    const maxAbs = Math.max(...areas.map((x) => Math.abs(x.mA - x.mB)).filter(Number.isFinite));
    if (Number.isFinite(maxAbs) && maxAbs <= 1) obsB.push('La magnitud de los cambios es de máximo 1 punto, lo cual no representa un cambio importante en los resultados.');
  }
  html += inf.sub('Puntajes por área',
    `${tieneB ? destacado(`${mejoran.length} DE 5 PRUEBAS`, `mejoraron respecto a ${ctx.anioB}`) : ''}${puntos(obsB)}
     ${ctx.rango.length > 1 ? imagen(cfgEvolucion(ctx.d, 'areas', GLOBAL), 330) : imagen(cfgPromedios(ctx.A), 300)}
     ${tablaHtml(['Prueba', ...ctx.rango.map(String), ...(tieneB ? [`Variación ${ctx.anioB}–${ctx.anioA}`, 'Variación en desv. estándar'] : [])],
       areas.map((x) => [x.a.nombre, ...ctx.rango.map((y) => fmt(mediaDe(ctx.d.filter((r) => r.anio === y), x.a.clave))), ...(tieneB ? [celdaSigno(x.mA - x.mB), fmt((x.mA - x.mB) / (x.de || 1), 2)] : [])]))}`);
  return html;
}

function secBrechas(ctx, inf) {
  const hay = (dim) => gruposDe(ctx.d, dim).length >= 2;
  const partes = [];
  if (hay('nse')) partes.push(() => subPorGrupo(ctx, inf, 'nse', 'Puntaje global por nivel socioeconómico (NSE)') .replace('</article>', `${nota('El NSE que presenta el ICFES clasifica a los evaluados según aspectos como el nivel educativo de los padres y los bienes y servicios del hogar. Va de 1 a 4, siendo el NSE 1 el más bajo (ver Anexo 1).')}</article>`));
  if (hay('naturaleza')) partes.push(() => subPorGrupo(ctx, inf, 'naturaleza', 'Puntaje global por sector educativo'));
  if (hay('naturaleza') && hay('nse')) partes.push(() => subConteo(ctx, inf, 'naturaleza', 'nse', 'Número de estudiantes por sector y nivel socioeconómico'));
  if (hay('zona')) partes.push(() => subPorGrupo(ctx, inf, 'zona', 'Puntaje global por zona'));
  if (hay('zona') && hay('nse')) partes.push(() => subConteo(ctx, inf, 'zona', 'nse', 'Número de estudiantes por zona y nivel socioeconómico'));
  if (hay('zona') && hay('naturaleza')) partes.push(() => sub2x2(ctx, inf, 'naturaleza', 'zona', 'Puntaje global por zona y sector'));
  if (hay('genero')) partes.push(() => subPorGrupo(ctx, inf, 'genero', 'Puntaje global por sexo'));
  if (hay('genero') && hay('nse')) partes.push(() => subConteo(ctx, inf, 'genero', 'nse', 'Número de estudiantes por sexo y nivel socioeconómico'));
  if (hay('genero') && hay('naturaleza')) partes.push(() => sub2x2(ctx, inf, 'naturaleza', 'genero', 'Puntaje global por sexo y sector'));
  if (hay('genero') && hay('naturaleza')) partes.push(() => subConteo(ctx, inf, 'genero', 'naturaleza', 'Número de estudiantes por sexo y sector'));
  if (!partes.length) return '';
  let html = inf.seccion(`Brechas educativas ${rangoTexto(ctx)}`, 'brechas');
  for (const p of partes) html += p();
  return html;
}

function secNiveles(ctx, inf) {
  let html = inf.seccion(`Niveles de desempeño por prueba evaluada ${rangoTexto(ctx)}`, 'niveles');
  const tieneB = ctx.B.length > 0;
  const hayNSE = gruposDe(ctx.A, 'nse').length >= 2;
  const general = [];
  if (tieneB) {
    let maxPP = 0;
    for (const a of AREAS) {
      const dA = distribucionNiveles(ctx.A, a), dB = distribucionNiveles(ctx.B, a);
      dA.niveles.forEach((n, i) => { const v = Math.abs(n.pct - dB.niveles[i].pct); if (Number.isFinite(v)) maxPP = Math.max(maxPP, v); });
    }
    general.push(`Las distribuciones de los estudiantes en los niveles de desempeño en ${ctx.anioA} ${maxPP <= 3 ? 'fueron similares' : 'presentaron cambios'} a las de ${ctx.anioB}, con variaciones de hasta ${fmt(maxPP)} puntos porcentuales.`);
  }
  if (hayNSE) general.push('En todas las pruebas se observa la relación: a mayor NSE, mayor probabilidad de ubicarse en los niveles de desempeño más altos.');
  if (general.length) html += `<article class="sub">${puntos(general)}</article>`;
  for (const a of AREAS) {
    const dA = distribucionNiveles(ctx.A, a), dB = tieneB ? distribucionNiveles(ctx.B, a) : null;
    const bajos = a.clave === 'ingles' ? 2 : 2; // niveles 1-2 o A- y A1
    const pBajoA = dA.niveles.slice(0, bajos).reduce((t, n) => t + n.pct, 0);
    const pAltoA = dA.niveles.at(-1).pct;
    const obs = [];
    const nombresBajos = a.clave === 'ingles' ? 'A- y A1' : '1 y 2';
    obs.push(`En ${ctx.anioA ?? 'el periodo'}, el <strong>${fmt(pBajoA)}%</strong> de los estudiantes se ubicó en los niveles ${nombresBajos}${dB ? ` (${signo(pBajoA - dB.niveles.slice(0, bajos).reduce((t, n) => t + n.pct, 0))} puntos porcentuales frente a ${ctx.anioB})` : ''} y el ${fmt(pAltoA)}% en el nivel ${a.clave === 'ingles' ? 'B+' : '4'}.`);
    const modal = [...dA.niveles].sort((x, y) => y.pct - x.pct)[0];
    obs.push(`El nivel con más estudiantes fue ${a.clave === 'ingles' ? modal.nivel : `el ${modal.nivel}`} (${fmt(modal.pct)}%).`);
    html += inf.sub(a.nombre, `${puntos(obs)}${ctx.rango.length ? imagen(cfgNivelesPorAnio(ctx, a), 60 + 45 * ctx.rango.length) : ''}${hayNSE ? imagen(cfgNivelesPorNSE(ctx.A, a), 250) : ''}`);
  }
  return html;
}

// --- territorios ---
function nombresUnidad(unidad) {
  return { departamento: 'departamentos', etc: 'ETC', municipio: 'municipios', colegio: 'colegios', region: 'regiones' }[unidad] || 'grupos';
}

function territorios(filas, unidad) {
  return agrupar(filas, unidad).filter((g) => g.clave !== '').map((g) => ({ nombre: etiqueta(unidad, g.clave), clave: g.clave, filas: g.filas, n: g.filas.length, media: mediaDe(g.filas) }))
    .filter((t) => t.media != null).sort((a, b) => b.media - a.media);
}

function variaciones(ctx, unidad) {
  const tb = new Map(territorios(ctx.B, unidad).map((t) => [t.clave, t]));
  return territorios(ctx.A, unidad).filter((t) => tb.has(t.clave)).map((t) => ({ ...t, nA: t.n, nB: tb.get(t.clave).n, v: t.media - tb.get(t.clave).media, filasB: tb.get(t.clave).filas }));
}

function secTerritorios(ctx, inf, u) {
  const unidad = u.territorio;
  if (!unidad) return '';
  const todos = territorios(ctx.A, unidad);
  if (todos.length < 2) return '';
  const max = Number(u.maxTerritorios) || 30;
  const recorte = (lista) => (lista.length > max ? [...lista].sort((a, b) => b.n - a.n).slice(0, max) : lista);
  const items = recorte(todos).sort((a, b) => b.media - a.media);
  const alto = (n) => Math.max(260, 60 + 22 * n);
  const nombreU = dimension(unidad).nombre;
  const total = mediaDe(ctx.A);
  const aviso = todos.length > max ? nota(`Se muestran los ${max} ${nombresUnidad(unidad)} con más estudiantes evaluados, de ${todos.length} en total.`) : '';
  let html = inf.seccion(`Resultados por ${nombreDim(unidad)}`, 'territorios');

  html += inf.sub(`Puntaje global por ${nombreDim(unidad)} ${ctx.anioA ?? ''}`,
    `${puntos([
      `Los puntajes promedio más altos se ubicaron en ${items.slice(0, 3).map((t) => `${esc(t.nombre)} (${fmt(t.media)})`).join(', ')}.`,
      `Los más bajos se ubicaron en ${items.slice(-3).reverse().map((t) => `${esc(t.nombre)} (${fmt(t.media)})`).join(', ')}.`,
      `El promedio del conjunto analizado fue ${fmt(total)} puntos; ${items.filter((t) => t.media >= total).length} de ${items.length} ${nombresUnidad(unidad)} están en o por encima de ese valor.`,
    ])}${imagen(cfgBarrasTerritorio(items, `Puntaje global promedio por ${nombreDim(unidad)} (${ctx.anioA ?? ''})`, (t) => t.media, (t) => (t.media >= total ? '#1d4ed8' : '#94a3b8'), 'Puntaje global promedio'), alto(items.length))}${aviso}`);

  if (ctx.B.length) {
    const vari = recorte(variaciones(ctx, unidad)).sort((a, b) => b.v - a.v);
    if (vari.length >= 2) {
      const suben = vari.filter((t) => t.v > 0).length;
      html += inf.sub(`Variación del puntaje por ${nombreDim(unidad)} ${ctx.anioB}–${ctx.anioA}`,
        `${puntos([
          `${suben} ${nombresUnidad(unidad)} mejoraron sus resultados frente a ${ctx.anioB} y ${vari.length - suben} ${vari.length - suben === 1 ? 'mostró' : 'mostraron'} una reducción.`,
          `Los de mayor crecimiento fueron ${vari.slice(0, 3).map((t) => `${esc(t.nombre)} (${signo(t.v, 2)})`).join(', ')}.`,
          vari.at(-1).v < 0 ? `Las mayores caídas se dieron en ${vari.filter((t) => t.v < 0).slice(-3).reverse().map((t) => `${esc(t.nombre)} (${signo(t.v, 2)})`).join(', ')}.` : null,
        ])}${imagen(cfgBarrasTerritorio(vari, `Variación del puntaje global promedio frente a ${ctx.anioB}`, (t) => t.v, (t) => (t.v >= 0 ? '#16a34a' : '#dc2626'), 'Variación (puntos)'), alto(vari.length))}`);
    }
  }

  if (unidad !== 'region' && gruposDe(ctx.A, 'region').length >= 2) {
    const reg = territorios(ctx.A, 'region');
    html += inf.sub(`Puntaje global por regiones ${ctx.anioA ?? ''}`,
      `${puntos([`La región con mejor desempeño fue ${esc(reg[0].nombre)} con ${fmt(reg[0].media)} puntos en promedio.`, `La región con el desempeño más bajo fue ${esc(reg.at(-1).nombre)} con ${fmt(reg.at(-1).media)} puntos.`])}
       ${imagen(cfgBarrasTerritorio(reg, 'Puntaje global promedio por región', (t) => t.media, () => '#1d4ed8', 'Puntaje global promedio'), alto(reg.length))}
       ${nota('Regiones: Caribe, Eje Cafetero, Pacífico, Central, Amazonía y Orinoquía, según el departamento del colegio.')}`);
  }

  html += inf.sub(`Puntaje acumulado por prueba por ${nombreDim(unidad)}`,
    `${puntos(['El gráfico muestra el aporte de cada prueba al puntaje global promedio según su ponderación: 3/13 para Matemáticas, Lectura Crítica, Ciencias Naturales y Sociales y Ciudadanas, y 1/13 para Inglés.'])}
     ${imagen(cfgAcumuladoPorPrueba(items), alto(items.length))}`);

  for (const [dim, nombreG] of [['naturaleza', 'sector'], ['zona', 'zona']]) {
    const grupos = gruposDe(ctx.A, dim);
    if (grupos.length < 2) continue;
    const [altoG, bajoG] = PARES_BRECHA[dim];
    const conAmbos = items.filter((t) => t.filas.some((r) => r[dim] === altoG) && t.filas.some((r) => r[dim] === bajoG));
    const favor = conAmbos.filter((t) => brechaDe(t.filas, dim, altoG, bajoG) > 0).length;
    const sinOferta = items.filter((t) => !t.filas.some((r) => r[dim] === altoG) || !t.filas.some((r) => r[dim] === bajoG)).map((t) => esc(t.nombre));
    html += inf.sub(`Puntaje global por ${nombreDim(unidad)} discriminado por ${nombreG}`,
      `${puntos([
        conAmbos.length ? `En ${favor} de ${conAmbos.length} ${nombresUnidad(unidad)} con ambos grupos, ${etiqueta(dim, altoG).toLowerCase()} obtuvo un promedio superior a ${etiqueta(dim, bajoG).toLowerCase()}.` : null,
        sinOferta.length ? `${sinOferta.slice(0, 8).join(', ')}${sinOferta.length > 8 ? '…' : ''} no ${sinOferta.length === 1 ? 'tiene' : 'tienen'} estudiantes de ambos grupos (${grupos.map((g) => etiqueta(dim, g).toLowerCase()).join(' / ')}).` : null,
      ])}${imagen(cfgTerritorioPorGrupo(items, dim, `Puntaje global promedio por ${nombreDim(unidad)} y ${nombreG}`), alto(items.length) + 40)}`);

    if (ctx.B.length) {
      const vari = recorte(variaciones(ctx, unidad));
      const filasT = vari.map((t) => [esc(t.nombre), ...grupos.map((g) => {
        const a = mediaDe(t.filas.filter((r) => r[dim] === g)), b = mediaDe(t.filasB.filter((r) => r[dim] === g));
        return a != null && b != null ? celdaSigno(a - b) : '—';
      })]);
      if (filasT.length) {
        html += inf.sub(`Variación del puntaje global por ${nombreDim(unidad)} y ${nombreG} ${ctx.anioB}–${ctx.anioA}`,
          tablaHtml([esc(nombreU), ...grupos.map((g) => esc(etiqueta(dim, g)))], filasT));
      }
    }
  }

  if (gruposDe(ctx.A, 'genero').length >= 2) {
    const pts = items.map((t) => ({ x: mediaDe(t.filas.filter((r) => r.genero === 'M')), y: mediaDe(t.filas.filter((r) => r.genero === 'F')), etiqueta: t.nombre })).filter((p) => p.x != null && p.y != null);
    if (pts.length >= 2) {
      const aFavorM = pts.filter((p) => p.y > p.x);
      html += inf.sub(`Brecha de género por ${nombreDim(unidad)}: hombres vs. mujeres`,
        `${puntos([
          'Los puntos por encima de la línea roja son los territorios donde las mujeres obtuvieron un promedio mayor que los hombres.',
          aFavorM.length ? `Solo en ${aFavorM.map((p) => `${esc(p.etiqueta)} (${fmt(p.y - p.x)} puntos)`).join(', ')} la diferencia fue a favor de las mujeres.` : `En todos los ${nombresUnidad(unidad)} los hombres obtuvieron un promedio mayor.`,
        ])}${imagen(cfgDispersionTerritorios(pts, 'Puntaje global promedio: hombres vs. mujeres', 'Hombres', 'Mujeres', true), 420)}`);
    }
  }

  if (gruposDe(ctx.A, 'naturaleza').length >= 2 && gruposDe(ctx.A, 'zona').length >= 2) {
    const pts = items.map((t) => ({ x: brechaDe(t.filas, 'naturaleza', 'NO OFICIAL', 'OFICIAL'), y: brechaDe(t.filas, 'zona', 'URBANO', 'RURAL'), etiqueta: t.nombre })).filter((p) => p.x != null && p.y != null);
    if (pts.length >= 2) {
      html += inf.sub(`Brechas de sector y zona por ${nombreDim(unidad)}`,
        `${puntos(['La brecha de sector es el puntaje promedio del sector no oficial menos el del oficial. La brecha de zona es el promedio urbano menos el rural. Valores positivos indican brecha a favor de los colegios no oficiales (eje X) o urbanos (eje Y).'])}
         ${imagen(cfgDispersionTerritorios(pts, 'Brechas de sector y zona', 'Brecha sector (no oficial − oficial)', 'Brecha zona (urbano − rural)', false), 420)}`);
    }
  }
  return html;
}

function secConclusiones(ctx, inf, u) {
  let html = inf.seccion('Conclusiones', 'conclusiones');
  const c = [];
  const gA = Est.resumen(col(ctx.A, 'global')), gB = Est.resumen(col(ctx.B, 'global'));
  if (ctx.B.length && gB.n) {
    const dG = gA.media - gB.media, deU = dG / (gB.de || 1);
    c.push(`El puntaje global promedio de Saber 11° ${ctx.anioA} ${verbo(dG)} ${fmt(Math.abs(dG))} puntos (${fmt(deU, 2)} desviaciones estándar) con respecto a ${ctx.anioB}.${Math.abs(deU) < 0.2 ? ' Sin embargo, este cambio no es sustantivo (menor a 0,2 desviaciones estándar).' : ''}`);
    const dN = ctx.A.length - ctx.B.length;
    c.push(`El número de evaluados ${verbo(dN)} en ${Math.abs(dN).toLocaleString('es-CO')} estudiantes (${signo(pctCambio(ctx.B.length, ctx.A.length))}%).`);
    const areas = AREAS.map((a) => ({ a, d: mediaDe(ctx.A, a.clave) - mediaDe(ctx.B, a.clave) })).filter((x) => Number.isFinite(x.d));
    const suben = areas.filter((x) => x.d > 0.05), bajan = areas.filter((x) => x.d < -0.05);
    const maxAbs = Math.max(...areas.map((x) => Math.abs(x.d)));
    const partes = [];
    if (suben.length) partes.push(`un incremento en ${unirY(suben.map((x) => x.a.nombre))}`);
    if (bajan.length) partes.push(`una reducción en ${unirY(bajan.map((x) => x.a.nombre))}`);
    c.push(`${partes.length ? `Frente a ${ctx.anioB} se observó ${partes.join(' y ')}` : `Los puntajes por prueba se mantuvieron frente a ${ctx.anioB}`}; la magnitud de estos cambios es de máximo ${fmt(maxAbs)} puntos${maxAbs <= 1 ? ', lo cual no representa un cambio importante en los resultados' : ''}.`);
  } else if (gA.n) {
    c.push(`El puntaje global promedio fue de ${fmt(gA.media)} puntos, con ${ctx.A.length.toLocaleString('es-CO')} estudiantes evaluados.`);
  }
  const gaps = [];
  for (const [dim, frase] of [['genero', ['las mujeres', 'los hombres']], ['zona', ['los estudiantes de zona rural', 'los de zona urbana']], ['naturaleza', ['los estudiantes de colegios oficiales', 'los de colegios no oficiales']]]) {
    const [alto, bajo] = PARES_BRECHA[dim];
    const b = brechaDe(ctx.A, dim, alto, bajo);
    if (b != null) gaps.push(b >= 0 ? `${frase[0]} obtuvieron ${fmt(b)} puntos por debajo de ${frase[1]}` : `${frase[0]} obtuvieron ${fmt(-b)} puntos por encima de ${frase[1]}`);
  }
  if (gaps.length) c.push(`Persisten brechas entre grupos: ${gaps.join('; ')}.`);
  const nse = brechaDe(ctx.A, 'nse', 'NSE4', 'NSE1');
  if (nse != null) c.push(`La diferencia entre los estudiantes del NSE 4 y del NSE 1 fue de ${fmt(nse)} puntos, lo que confirma la fuerte relación entre nivel socioeconómico y resultados.`);
  const bajos = AREAS.slice(0, 4).map((a) => ({ a, p: distribucionNiveles(ctx.A, a).niveles.slice(0, 2).reduce((t, n) => t + n.pct, 0) }));
  const altos3 = AREAS.slice(0, 4).map((a) => ({ a, p: distribucionNiveles(ctx.A, a).niveles[2].pct }));
  const preocupa = bajos.filter((x) => x.p >= 50);
  const bien = altos3.filter((x) => x.p >= 40);
  if (bien.length) c.push(`Es positivo que ${bien.map((x) => `el ${fmt(x.p)}% en ${x.a.nombre}`).join(' y ')} se ubique en el nivel 3 de desempeño.`);
  if (preocupa.length) c.push(`Es preocupante que en ${unirY(preocupa.map((x) => `${x.a.nombre} (${fmt(x.p)}%)`))} más de la mitad de los estudiantes se ubique en los niveles de desempeño más bajos (1 y 2).`);
  const ing = distribucionNiveles(ctx.A, AREAS[4]);
  if (ing.total) {
    const pBajo = ing.niveles[0].pct + ing.niveles[1].pct;
    c.push(`En Inglés, el ${fmt(pBajo)}% de los estudiantes está en los niveles A- y A1: no alcanza a comprender textos sobre temas generales, inferir el significado de palabras desconocidas a partir del contexto ni identificar puntos de vista.`);
  }
  if (u.territorio) {
    const t = territorios(ctx.A, u.territorio).filter((x) => x.n >= 5);
    if (t.length >= 2) c.push(`Por ${nombreDim(u.territorio)}, la diferencia entre el mejor (${esc(t[0].nombre)}, ${fmt(t[0].media)}) y el de menor puntaje (${esc(t.at(-1).nombre)}, ${fmt(t.at(-1).media)}) es de ${fmt(t[0].media - t.at(-1).media)} puntos.`);
  }
  html += `<article class="sub">${puntos(c)}</article>`;
  if (u.notas.trim()) html += `<article class="sub"><h3>Observaciones</h3><p style="white-space:pre-wrap">${esc(u.notas)}</p></article>`;
  return html;
}

function secAnexos(ctx, inf) {
  inf.toc.push({ nivel: 1, texto: 'Anexos', id: 'inf-anexos' });
  let html = '<div class="banda" id="inf-anexos">ANEXOS</div>';
  if (gruposDe(ctx.d, 'nse').length) {
    inf.toc.push({ nivel: 2, texto: 'Anexo 1. Características de los estudiantes por NSE' });
    html += `<article class="sub"><h3>Anexo 1. Características de los estudiantes por NSE</h3>
      <div class="nse-grid">
        <div><h4>NSE 1</h4><ul><li>Ausencia de computador e internet en el hogar, y de electrodomésticos como horno o lavadora.</li><li>Bajo nivel educativo de los padres; es común que la primaria sea el nivel más alto alcanzado por la madre.</li><li>Bajo consumo de leche, carne y huevos; poca o nula tenencia de libros.</li></ul></div>
        <div><h4>NSE 2</h4><ul><li>Posesión de lavadora y servicio de televisión; la falta de computador e internet es menos marcada que en el NSE 1.</li><li>El nivel educativo más frecuente de la madre es secundaria completa.</li><li>Mayor consumo de alimentos proteicos y mayor tenencia de libros.</li></ul></div>
        <div><h4>NSE 3</h4><ul><li>Madres con secundaria completa y con frecuencia educación técnica, tecnológica o profesional.</li><li>Tenencia de horno microondas o a gas.</li><li>Consumo diario o casi diario de carne, huevos y leche.</li></ul></div>
        <div><h4>NSE 4</h4><ul><li>Computador, internet, consola de videojuegos y automóvil en el hogar.</li><li>Padres con educación profesional completa y en algunos casos posgrado.</li><li>Consumo diario o casi diario de carne, huevos, leche y derivados.</li></ul></div>
      </div>${nota('Fuente: Icfes (2019), Saber al detalle.')}</article>`;
  }
  inf.toc.push({ nivel: 2, texto: 'Anexo 2. Nota metodológica' });
  const cortes = AREAS.map((a) => [a.nombre, ...a.niveles.map((n, i) => `${a.clave === 'ingles' ? n.nombre : 'Nivel ' + n.nombre}: ${n.min}–${a.niveles[i + 1] ? a.niveles[i + 1].min - 1 : 100}`)]);
  const l = estado.limpieza;
  html += `<article class="sub"><h3>Anexo 2. Nota metodológica</h3>
    ${puntos([
      'Puntaje global: PG = [3 × (Matemáticas + Lectura Crítica + Ciencias Naturales + Sociales y Ciudadanas) + Inglés] / 13 × 5, en escala de 0 a 500.',
      'Los cambios se expresan en puntos y en desviaciones estándar del año de comparación; cambios menores a 0,2 desviaciones estándar se consideran poco sustantivos.',
      'La significancia estadística de las diferencias entre dos grupos se evalúa con la prueba t de Welch (p < 0,05).',
      l ? `Datos: se leyeron ${l.leidas.toLocaleString('es-CO')} filas de ${estado.archivos.length} archivo(s) y, tras la limpieza, quedaron ${l.datos.length.toLocaleString('es-CO')} registros válidos. Filtros aplicados: ${esc(descripcionFiltros())}.` : null,
    ])}
    <h4>Puntos de corte de los niveles de desempeño</h4>
    ${tablaHtml(['Prueba', 'Nivel 1 / A-', 'Nivel 2 / A1', 'Nivel 3 / A2', 'Nivel 4 / B1', 'B+'], cortes.map((f) => [...f, ...Array(6 - f.length).fill('')]))}
    ${l && l.pasos.length ? `<h4>Correcciones aplicadas en la limpieza</h4>${tablaHtml(['Paso', 'Cantidad'], l.pasos.map((p) => [esc(p.texto), p.cantidad.toLocaleString('es-CO')]))}` : ''}
  </article>`;
  return html;
}

// ------------------------------------------------------------
//  Pantalla del informe
// ------------------------------------------------------------

function unidadesDisponibles(d) {
  return UNIDADES_TERRITORIO.filter((k) => gruposDe(d, k).length >= 2).map((k) => [k, dimension(k).nombre]);
}

function renderInforme() {
  const cont = $('#tab-informe');
  const d = filtrados();
  if (!d.length) { cont.innerHTML = vacio(); return; }
  const u = estado.ui.informe;
  const anios = gruposDe(d, 'anio');
  const unidades = unidadesDisponibles(d);
  if (!unidades.some(([k]) => k === u.territorio)) u.territorio = unidades[0]?.[0] ?? '';
  if (!u.autor && estado.usuario) u.autor = [estado.usuario.institucion, estado.usuario.nombre].filter(Boolean).join(' · ');
  const anioA = anios.includes(Number(u.anio)) ? Number(u.anio) : anios.at(-1);
  const previos = anios.filter((a) => a < anioA);
  const previo = $('#informe-doc');
  cont.innerHTML = `<div class="tarjeta no-imprimir"><h2>Informe de análisis de resultados</h2>
      <p class="nota">Estructura basada en el documento de referencia "Análisis de resultados examen Saber 11°": contexto y hallazgos, puntajes promedio, brechas educativas, niveles de desempeño, resultados por territorio, conclusiones y anexos.
        Los apartados se incluyen solo si los datos traen la información necesaria (por ejemplo, NSE, sector o zona). Usa los filtros de arriba: ${esc(descripcionFiltros())}.</p>
      <div class="fila-controles">
        <label class="control" style="flex:1 1 300px">Título<input data-informe="titulo" value="${esc(u.titulo)}" placeholder="Análisis de resultados examen Saber 11° ${anioA ?? ''}"></label>
        <label class="control" style="flex:1 1 240px">Entidad / autor<input data-informe="autor" value="${esc(u.autor)}" placeholder="Opcional"></label>
      </div>
      <div class="fila-controles">
        ${anios.length ? `<label class="control">Año de análisis<select data-informe="anio">${opcionesHtml(anios.map((a) => [a, a]), anioA)}</select></label>` : ''}
        ${previos.length ? `<label class="control">Comparar con<select data-informe="comparacion">${opcionesHtml(previos.map((a) => [a, a]), previos.includes(Number(u.comparacion)) ? u.comparacion : previos.at(-1))}</select></label>` : ''}
        ${unidades.length ? `<label class="control">Análisis territorial por<select data-informe="territorio">${opcionesHtml(unidades, u.territorio)}</select></label>` : ''}
        <label class="control">Máximo de territorios en gráficos<select data-informe="maxTerritorios">${opcionesHtml([[15, '15'], [30, '30'], [50, '50'], [100, '100']], u.maxTerritorios)}</select></label>
      </div>
      <div class="opciones" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">${SECCIONES_INFORME.map(([k, t]) => `<label><input type="checkbox" data-seccion="${k}"${u.secciones[k] ? ' checked' : ''}> ${t}</label>`).join('')}</div>
      <label class="control">Observaciones propias (se agregan a las conclusiones)<textarea data-informe="notas" placeholder="Ej.: acciones de mejora acordadas por el consejo académico…">${esc(u.notas)}</textarea></label>
      <div class="fila-botones">
        <button class="btn" id="btn-generar">Generar informe</button>
        <button class="btn secundario" id="btn-imprimir">Imprimir / Guardar PDF</button>
        <button class="btn secundario" data-accion-global="excel">Descargar resultados (Excel)</button>
      </div></div>
    <div id="informe-doc">${previo ? previo.innerHTML : ''}</div>`;
}

function generarInforme() {
  const datos = filtrados();
  const u = estado.ui.informe;
  const s = u.secciones;
  const ctx = contextoInforme(datos, u);
  const inf = nuevoInforme();
  const hoy = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const tituloInf = u.titulo.trim() || `Análisis de resultados examen Saber 11° ${ctx.anioA ?? ''}`;

  let cuerpo = '';
  if (s.contexto) cuerpo += secContexto(ctx, inf, u);
  if (s.promedios) cuerpo += secPromedios(ctx, inf);
  if (s.brechas) cuerpo += secBrechas(ctx, inf);
  if (s.niveles) cuerpo += secNiveles(ctx, inf);
  if (s.territorios) cuerpo += secTerritorios(ctx, inf, u);
  if (s.conclusiones) cuerpo += secConclusiones(ctx, inf, u);
  if (s.anexos) cuerpo += secAnexos(ctx, inf);

  const toc = `<nav class="toc"><h2>TABLA DE CONTENIDO</h2>${inf.toc.map((t) => (t.nivel === 1 ? `<div class="toc-1">${esc(t.texto)}</div>` : `<div class="toc-2">${esc(t.texto)}</div>`)).join('')}</nav>`;
  const portada = `<div class="portada">
      <div class="portada-marca">SABER 11°</div>
      <h1>${esc(tituloInf.toUpperCase())}</h1>
      <p class="portada-sub">${ctx.rango.length > 1 ? `Periodo analizado ${rangoTexto(ctx)}` : ''}${ctx.anioB ? ` · Comparación ${ctx.anioB}–${ctx.anioA}` : ''}</p>
      <p class="portada-meta">${u.autor ? `${esc(u.autor)}<br>` : ''}${hoy}<br>${ctx.A.length.toLocaleString('es-CO')} estudiantes evaluados en ${ctx.anioA ?? 'el periodo'}</p>
    </div>`;
  $('#informe-doc').innerHTML = `<div class="informe inf2">${portada}${toc}${cuerpo}
    <p class="nota" style="margin-top:30px">Informe generado con Análisis Saber 11 a partir de los datos cargados. Niveles de desempeño según los puntos de corte del ICFES.</p></div>`;
  $('#informe-doc').scrollIntoView({ behavior: 'smooth' });
}
