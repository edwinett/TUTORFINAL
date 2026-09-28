// Lectura de archivos Excel/CSV, reconocimiento de columnas y limpieza de datos.

const Datos = (() => {
  // "Puntaje Lectura Crítica " -> "puntaje_lectura_critica"
  function normalizar(txt) {
    return String(txt ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function limpiarTexto(v) {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v ?? '').replace(/\s+/g, ' ').trim();
  }

  // Mayúsculas, sin espacios de sobra y sin tildes (la Ñ se conserva).
  function categoria(v) {
    const s = limpiarTexto(v).replace(/^["']+|["']+$/g, '').toUpperCase();
    return s.replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'Ñ');
  }

  // Devuelve un número, null si la celda está vacía o NaN si es texto que no es número.
  function aNumero(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (v == null || v instanceof Date) return null;
    let s = String(v).trim();
    if (!s) return null;
    if (/^(na|n\/a|n\.a\.?|nan|null|none|-+|\.|sin dato|sin datos|s\/d|sd|no aplica|no presento|no presentó|ausente)$/i.test(s)) return null;
    s = s.replace(/[^\d,.\-]/g, '');
    if (!/\d/.test(s)) return NaN;
    if (s.includes(',') && s.includes('.')) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function aAnio(v) {
    if (v instanceof Date) return v.getFullYear();
    const m = String(v ?? '').match(/(19|20)\d{2}/);
    return m ? Number(m[0]) : null;
  }

  function estandarGenero(v) {
    const c = categoria(v);
    if (/^(F|FEM|FEMENINO|FEMENINA|MUJER|NIÑA)$/.test(c)) return 'F';
    if (/^(M|MASC|MASCULINO|HOMBRE|NIÑO)$/.test(c)) return 'M';
    return c;
  }

  // --- Lectura de archivos ---
  function parsearCSV(texto) {
    texto = texto.replace(/^﻿/, '');
    const primera = texto.split(/\r?\n/).find((l) => l.trim()) || '';
    const candidatos = [',', ';', '\t', '|', '¬'];
    const sep = candidatos.reduce((mejor, c) => (primera.split(c).length > primera.split(mejor).length ? c : mejor), ',');
    const filas = [];
    let fila = [], campo = '', comillas = false;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (comillas) {
        if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (ch === '"') comillas = false;
        else campo += ch;
      } else if (ch === '"' && campo === '') comillas = true;
      else if (ch === sep) { fila.push(campo); campo = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && texto[i + 1] === '\n') i++;
        fila.push(campo); filas.push(fila); fila = []; campo = '';
      } else campo += ch;
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
  }

  async function leerArchivo(file) {
    const buf = await file.arrayBuffer();
    if (/\.(csv|txt)$/i.test(file.name)) {
      let texto = new TextDecoder('utf-8').decode(buf);
      if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(buf);
      return { [file.name.replace(/\.[^.]+$/, '')]: parsearCSV(texto) };
    }
    return leerLibro(XLSX.read(buf, { type: 'array', cellDates: true }));
  }

  function leerLibro(wb) {
    const hojas = {};
    for (const nombre of wb.SheetNames) {
      hojas[nombre] = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: '', raw: true, blankrows: true });
    }
    return hojas;
  }

  // --- Reconocimiento de columnas ---
  function puntuar(campo, encabezadoNorm) {
    const h = encabezadoNorm;
    if (!h) return 0;
    let s = 0;
    campo.sinonimos.forEach((sin, k) => {
      if (h === sin) s = Math.max(s, 100 - k);
      else if (sin.length >= 4 && (h.startsWith(sin + '_') || h.endsWith('_' + sin) || h.includes('_' + sin + '_'))) s = Math.max(s, 40 - k);
    });
    if (campo.numerico && /(desemp|nivel|percentil|decil|ranking|puesto|posicion|estrato)/.test(h)) s = 0;
    if (campo.clave === 'id' && /(tipo|nombre)/.test(h)) s = 0;
    if (campo.clave === 'colegio' && /(codigo|cod_|dane|sede|mcpio|depto|municipio|departamento)/.test(h)) s = 0;
    if (campo.clave === 'nombre' && /(cole|establecimiento|institucion|sede|mcpio|municipio|depto)/.test(h)) s = 0;
    return s;
  }

  function sugerirMapeo(encabezados) {
    const norm = encabezados.map(normalizar);
    const candidatos = [];
    for (const campo of CAMPOS) {
      norm.forEach((h, j) => {
        const s = puntuar(campo, h);
        if (s > 0) candidatos.push({ campo: campo.clave, j, s });
      });
    }
    candidatos.sort((a, b) => b.s - a.s);
    const mapeo = {};
    CAMPOS.forEach((c) => { mapeo[c.clave] = -1; });
    const usadas = new Set();
    for (const c of candidatos) {
      if (mapeo[c.campo] >= 0 || usadas.has(c.j)) continue;
      mapeo[c.campo] = c.j;
      usadas.add(c.j);
    }
    return mapeo;
  }

  // Busca la fila de encabezados: muchos informes traen títulos o logos en las primeras filas.
  function detectarEncabezado(filas) {
    let mejor = -1, mejorPuntos = 0;
    const limite = Math.min(filas.length, 40);
    for (let i = 0; i < limite; i++) {
      const puntos = (filas[i] || []).reduce((t, c) => {
        const h = normalizar(c);
        return t + Math.max(0, ...CAMPOS.map((campo) => (puntuar(campo, h) >= 60 ? 3 : puntuar(campo, h) > 0 ? 1 : 0)));
      }, 0);
      if (puntos > mejorPuntos) { mejor = i; mejorPuntos = puntos; }
    }
    if (mejor >= 0) return { fila: mejor, puntos: mejorPuntos };
    const primera = filas.findIndex((f) => (f || []).filter((c) => String(c).trim()).length >= 2);
    return { fila: Math.max(0, primera), puntos: 0 };
  }

  function encabezadosDe(filas, fila) {
    return (filas[fila] || []).map((c, j) => limpiarTexto(c) || `Columna ${j + 1}`);
  }

  let contador = 0;
  function prepararArchivo(nombre, hojas) {
    const nombres = Object.keys(hojas);
    let hoja = nombres[0], fila = 0, mejor = -1;
    for (const n of nombres) {
      const d = detectarEncabezado(hojas[n]);
      if (d.puntos > mejor) { mejor = d.puntos; hoja = n; fila = d.fila; }
    }
    const archivo = { id: ++contador, nombre, hojas, hoja, filaEncabezado: fila, encabezados: [], mapeo: {}, anioManual: '', colegioManual: '' };
    aplicarEncabezado(archivo);
    const anioNombre = aAnio(nombre);
    if (archivo.mapeo.periodo < 0 && anioNombre) archivo.anioManual = String(anioNombre);
    return archivo;
  }

  function cambiarHoja(archivo, hoja) {
    archivo.hoja = hoja;
    archivo.filaEncabezado = detectarEncabezado(archivo.hojas[hoja]).fila;
    aplicarEncabezado(archivo);
  }

  function aplicarEncabezado(archivo) {
    archivo.encabezados = encabezadosDe(archivo.hojas[archivo.hoja] || [], archivo.filaEncabezado);
    archivo.mapeo = sugerirMapeo(archivo.encabezados);
  }

  // --- Limpieza ---
  const PASOS = [
    { clave: 'titulos', texto: 'Filas de título omitidas (antes de los encabezados)', tipo: 'correccion' },
    { clave: 'vacias', texto: 'Filas vacías eliminadas', tipo: 'correccion' },
    { clave: 'encabezadosRepetidos', texto: 'Encabezados repetidos dentro de los datos eliminados', tipo: 'correccion' },
    { clave: 'filasResumen', texto: 'Filas de totales / promedios eliminadas', tipo: 'correccion' },
    { clave: 'textos', texto: 'Celdas de texto normalizadas (espacios, mayúsculas, tildes)', tipo: 'correccion' },
    { clave: 'genero', texto: 'Valores de género estandarizados a F / M', tipo: 'correccion' },
    { clave: 'numerosCorregidos', texto: 'Puntajes escritos como texto convertidos a número (comas, espacios, "pts")', tipo: 'correccion' },
    { clave: 'noNumericos', texto: 'Puntajes con texto no numérico convertidos en vacío', tipo: 'correccion' },
    { clave: 'fueraRango', texto: 'Puntajes fuera de rango convertidos en vacío', tipo: 'correccion' },
    { clave: 'duplicados', texto: 'Registros duplicados eliminados', tipo: 'correccion' },
    { clave: 'globalCalculado', texto: 'Puntajes globales calculados con la fórmula oficial', tipo: 'correccion' },
    { clave: 'sinPuntajes', texto: 'Registros sin ningún puntaje eliminados', tipo: 'correccion' },
    { clave: 'globalInconsistente', texto: 'Puntaje global que no coincide con las áreas (solo aviso)', tipo: 'aviso' },
    { clave: 'sinAnio', texto: 'Registros sin año (asigne uno en el paso 1)', tipo: 'aviso' },
    { clave: 'sinColegio', texto: 'Registros sin colegio (asigne uno en el paso 1)', tipo: 'aviso' },
    { clave: 'sinDuplicadoPosible', texto: 'No se buscaron duplicados en archivos sin identificador ni nombre', tipo: 'aviso' },
  ];

  function procesar(archivos, op) {
    const conteo = {};
    const sumar = (k, n = 1) => { conteo[k] = (conteo[k] || 0) + n; };
    const problemas = [];
    const anotar = (r, campo, valor, accion) => {
      if (problemas.length < 2000) problemas.push({ archivo: r.archivo, fila: r.fila, campo, valor: limpiarTexto(valor), accion });
    };
    let leidas = 0;
    const registros = [];

    for (const a of archivos) {
      const filas = a.hojas[a.hoja] || [];
      const m = a.mapeo;
      const encNorm = a.encabezados.map(normalizar);
      const nEnc = encNorm.filter(Boolean).length;
      const anioManual = aAnio(a.anioManual);
      const titulos = filas.slice(0, a.filaEncabezado).filter((f) => (f || []).some((c) => limpiarTexto(c))).length;
      if (titulos) sumar('titulos', titulos);

      for (let i = a.filaEncabezado + 1; i < filas.length; i++) {
        const fila = filas[i] || [];
        leidas++;
        if (fila.every((c) => limpiarTexto(c) === '')) { sumar('vacias'); continue; }
        const celda = (campo) => (m[campo] >= 0 ? fila[m[campo]] : '');

        if (op.resumen) {
          const iguales = fila.filter((c, j) => encNorm[j] && normalizar(c) === encNorm[j]).length;
          if (iguales >= Math.max(2, Math.ceil(nEnc / 2))) { sumar('encabezadosRepetidos'); continue; }
          const primerTexto = fila.find((c) => typeof c === 'string' && c.trim());
          const idVal = limpiarTexto(celda('id'));
          if (primerTexto && /^(total|totales|promedio|promedios|media|resumen|consolidado|subtotal)\b/i.test(primerTexto.trim()) && !/\d/.test(idVal)) {
            sumar('filasResumen'); continue;
          }
        }

        const r = { archivo: a.nombre, fila: i + 1 };
        r.id = limpiarTexto(celda('id'));
        r.nombre = limpiarTexto(celda('nombre'));
        for (const c of ['colegio', 'sede', 'municipio', 'jornada', 'naturaleza', 'grupo']) {
          const orig = limpiarTexto(celda(c));
          let v = orig;
          if (op.textos && v) { v = categoria(v); if (v !== String(celda(c) ?? '')) sumar('textos'); }
          r[c] = v;
        }
        if (!r.colegio && a.colegioManual) r.colegio = op.textos ? categoria(a.colegioManual) : limpiarTexto(a.colegioManual);

        const gOrig = limpiarTexto(celda('genero'));
        r.genero = gOrig;
        if (gOrig && op.genero) { r.genero = estandarGenero(gOrig); if (r.genero !== gOrig) sumar('genero'); }
        else if (gOrig && op.textos) r.genero = categoria(gOrig);

        r.anio = aAnio(celda('periodo')) ?? anioManual ?? '';

        for (const p of PUNTAJES) {
          const orig = celda(p.clave);
          let v = aNumero(orig);
          if (Number.isNaN(v)) {
            sumar('noNumericos'); anotar(r, p.nombre, orig, 'Texto no numérico → vacío'); v = null;
          } else if (v != null && typeof orig === 'string' && orig.trim() !== String(v)) {
            sumar('numerosCorregidos'); anotar(r, p.nombre, orig, `Convertido a ${v}`);
          }
          if (v != null && op.rango && (v < 0 || v > p.max)) {
            sumar('fueraRango'); anotar(r, p.nombre, orig, `Fuera de rango (0–${p.max}) → vacío`); v = null;
          }
          r[p.clave] = v;
        }
        registros.push(r);
      }
    }

    let datos = registros;
    if (op.duplicados) {
      const vistos = new Set();
      datos = [];
      let sinClave = 0;
      for (const r of registros) {
        let clave = null;
        if (r.id) clave = `id|${r.id}|${r.anio}`;
        else if (r.nombre) clave = `nom|${categoria(r.nombre)}|${r.anio}|${r.colegio}`;
        if (clave == null) { sinClave++; datos.push(r); continue; }
        if (vistos.has(clave)) { sumar('duplicados'); anotar(r, 'Registro', r.id || r.nombre, 'Duplicado eliminado'); continue; }
        vistos.add(clave);
        datos.push(r);
      }
      if (sinClave) sumar('sinDuplicadoPosible', sinClave);
    }

    for (const r of datos) {
      const areas = AREAS.map((a) => r[a.clave]);
      if (!areas.every((v) => v != null)) continue;
      const calc = calcularGlobal(...areas);
      if (r.global == null) {
        if (op.calcularGlobal) { r.global = calc; sumar('globalCalculado'); }
      } else if (Math.abs(calc - r.global) > 5) {
        sumar('globalInconsistente'); anotar(r, GLOBAL.nombre, r.global, `No coincide con las áreas (calculado: ${calc}). Solo aviso.`);
      }
    }

    if (op.sinPuntajes) {
      const antes = datos.length;
      datos = datos.filter((r) => PUNTAJES.some((p) => r[p.clave] != null));
      if (antes - datos.length) sumar('sinPuntajes', antes - datos.length);
    }
    const sinAnio = datos.filter((r) => r.anio === '').length;
    const sinColegio = datos.filter((r) => !r.colegio).length;
    if (sinAnio) sumar('sinAnio', sinAnio);
    if (sinColegio) sumar('sinColegio', sinColegio);

    const pasos = PASOS.filter((p) => conteo[p.clave]).map((p) => ({ ...p, cantidad: conteo[p.clave] }));
    return { datos, leidas, pasos, problemas };
  }

  // --- Datos de ejemplo (ficticios y con errores a propósito, para probar la limpieza) ---
  function generarEjemplo() {
    let semilla = 20240917;
    const azar = () => {
      semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0;
      let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const normal = () => Math.sqrt(-2 * Math.log(1 - azar())) * Math.cos(2 * Math.PI * azar());
    const colegios = [
      { nombre: 'Institución Educativa San José', naturaleza: 'OFICIAL', jornada: 'MAÑANA', efecto: 2 },
      { nombre: 'Colegio Nuestra Señora del Carmen', naturaleza: 'NO OFICIAL', jornada: 'COMPLETA', efecto: 7 },
      { nombre: 'I.E. Técnico Industrial', naturaleza: 'OFICIAL', jornada: 'TARDE', efecto: -3 },
    ];
    const medias = { lectura: 53, matematicas: 50, sociales: 48, naturales: 49, ingles: 51 };
    const filas = [
      ['RESULTADOS PRUEBAS SABER 11 — DATOS FICTICIOS DE EJEMPLO'],
      ['Generado para probar la aplicación. No corresponde a estudiantes reales.'],
      [],
      ['ESTU_CONSECUTIVO', 'PERIODO', 'COLE_NOMBRE_ESTABLECIMIENTO', 'COLE_JORNADA', 'COLE_NATURALEZA', 'GRUPO', 'ESTU_GENERO',
        'PUNT_LECTURA_CRITICA', 'PUNT_MATEMATICAS', 'PUNT_SOCIALES_CIUDADANAS', 'PUNT_C_NATURALES', 'PUNT_INGLES', 'PUNT_GLOBAL'],
    ];
    let consecutivo = 1000;
    for (const anio of [2022, 2023, 2024]) {
      colegios.forEach((col, ci) => {
        const n = 45 + Math.floor(azar() * 30);
        for (let k = 0; k < n; k++) {
          const z = normal();
          const tendencia = (anio - 2022) * (ci === 2 ? 2.5 : 1);
          const p = {};
          for (const [clave, m] of Object.entries(medias)) {
            const extra = clave === 'ingles' && ci === 1 ? 6 : 0;
            p[clave] = Math.max(0, Math.min(100, Math.round(m + col.efecto + tendencia + extra + 10 * (0.75 * z + 0.66 * normal()))));
          }
          const global = calcularGlobal(p.lectura, p.matematicas, p.sociales, p.naturales, p.ingles);
          const genero = azar() < 0.52 ? 'F' : 'M';
          filas.push([`SB11${anio}${consecutivo++}`, Number(`${anio}2`), col.nombre, col.jornada, col.naturaleza,
            `11-${1 + Math.floor(azar() * 3)}`, genero, p.lectura, p.matematicas, p.sociales, p.naturales, p.ingles, global]);
        }
      });
    }
    // Errores típicos de un Excel real, para que la limpieza tenga trabajo.
    const datos = filas.slice(4);
    const fila = (i) => datos[i % datos.length];
    fila(3)[2] = '  institución educativa san josé '; // espacios y minúsculas
    fila(10)[6] = 'Femenino'; fila(11)[6] = 'masculino'; fila(12)[6] = 'f';
    fila(20)[7] = '58,0'; fila(21)[8] = '47 pts'; fila(22)[11] = 'N/A';
    fila(30)[8] = 150; // fuera de rango
    fila(40)[12] = ''; fila(41)[12] = ''; // global faltante (se calcula)
    fila(50)[9] = 'ausente'; fila(51)[10] = 'xx';
    fila(60)[3] = 'Mañana ';
    const extra = [datos[5].slice(), datos[6].slice(), [], datos[70].slice(), [], filas[3].slice()];
    filas.push(...extra, ['PROMEDIO', '', '', '', '', '', '', 52, 50, 48, 49, 51, 250]);
    return { nombre: 'ejemplo_saber11_ficticio.xlsx', hojas: { Resultados: filas } };
  }

  function libroEjemplo() {
    const ej = generarEjemplo();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ej.hojas.Resultados), 'Resultados');
    return wb;
  }

  return { normalizar, leerArchivo, leerLibro, prepararArchivo, cambiarHoja, aplicarEncabezado, procesar, generarEjemplo, libroEjemplo };
})();
