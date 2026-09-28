// Configuración de las pruebas Saber 11: áreas, rangos y niveles de desempeño.
// Los puntos de corte siguen la guía de interpretación del ICFES; si el ICFES los
// cambia, basta con ajustar los números aquí.

const AREAS = [
  {
    clave: 'lectura', nombre: 'Lectura Crítica', corto: 'Lectura', max: 100, color: '#2563eb',
    niveles: [{ nombre: '1', min: 0 }, { nombre: '2', min: 36 }, { nombre: '3', min: 51 }, { nombre: '4', min: 66 }],
  },
  {
    clave: 'matematicas', nombre: 'Matemáticas', corto: 'Matemáticas', max: 100, color: '#dc2626',
    niveles: [{ nombre: '1', min: 0 }, { nombre: '2', min: 36 }, { nombre: '3', min: 51 }, { nombre: '4', min: 71 }],
  },
  {
    clave: 'sociales', nombre: 'Sociales y Ciudadanas', corto: 'Sociales', max: 100, color: '#d97706',
    niveles: [{ nombre: '1', min: 0 }, { nombre: '2', min: 41 }, { nombre: '3', min: 56 }, { nombre: '4', min: 71 }],
  },
  {
    clave: 'naturales', nombre: 'Ciencias Naturales', corto: 'C. Naturales', max: 100, color: '#16a34a',
    niveles: [{ nombre: '1', min: 0 }, { nombre: '2', min: 41 }, { nombre: '3', min: 56 }, { nombre: '4', min: 71 }],
  },
  {
    clave: 'ingles', nombre: 'Inglés', corto: 'Inglés', max: 100, color: '#7c3aed',
    niveles: [{ nombre: 'A-', min: 0 }, { nombre: 'A1', min: 48 }, { nombre: 'A2', min: 58 }, { nombre: 'B1', min: 68 }, { nombre: 'B+', min: 79 }],
  },
];

const GLOBAL = { clave: 'global', nombre: 'Puntaje Global', corto: 'Global', max: 500, color: '#0f766e' };

// Todos los puntajes numéricos (5 áreas + global).
const PUNTAJES = [...AREAS, GLOBAL];

const COLORES_NIVEL = {
  '1': '#dc2626', '2': '#f59e0b', '3': '#3b82f6', '4': '#16a34a',
  'A-': '#dc2626', 'A1': '#f97316', 'A2': '#eab308', 'B1': '#3b82f6', 'B+': '#16a34a',
};

const COLORES_GRUPO = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569', '#ea580c'];

// Campos que la app sabe leer. Los "sinónimos" son nombres de columna (ya normalizados:
// minúsculas, sin tildes, con "_") que se reconocen automáticamente. Los primeros de la
// lista tienen prioridad.
const CAMPOS = [
  { clave: 'id', nombre: 'Identificador del estudiante', sinonimos: ['estu_consecutivo', 'consecutivo', 'estu_nro_documento', 'nro_documento', 'numero_documento', 'documento', 'identificacion', 'num_registro', 'registro', 'snp', 'estu_snp', 'codigo', 'id'] },
  { clave: 'nombre', nombre: 'Nombre del estudiante', sinonimos: ['estu_nombre', 'nombre_estudiante', 'nombres_y_apellidos', 'apellidos_y_nombres', 'nombre_completo', 'estudiante', 'nombres', 'nombre'] },
  { clave: 'periodo', nombre: 'Año / periodo', sinonimos: ['periodo', 'ano', 'anio', 'year', 'vigencia', 'cohorte', 'fecha_presentacion', 'fecha'] },
  { clave: 'colegio', nombre: 'Colegio / institución', sinonimos: ['cole_nombre_establecimiento', 'nombre_establecimiento', 'establecimiento', 'institucion_educativa', 'institucion', 'nombre_institucion', 'colegio', 'nombre_colegio', 'ie'] },
  { clave: 'sede', nombre: 'Sede', sinonimos: ['cole_nombre_sede', 'nombre_sede', 'sede'] },
  { clave: 'departamento', nombre: 'Departamento', sinonimos: ['cole_depto_ubicacion', 'nombre_departamento', 'departamento', 'depto'] },
  { clave: 'etc', nombre: 'Entidad territorial certificada (ETC)', sinonimos: ['cole_etc', 'etc', 'nombre_etc', 'entidad_territorial_certificada', 'entidad_territorial', 'secretaria_de_educacion', 'secretaria_educacion', 'secretaria'] },
  { clave: 'municipio', nombre: 'Municipio', sinonimos: ['cole_mcpio_ubicacion', 'nombre_municipio', 'municipio', 'ciudad', 'mcpio'] },
  { clave: 'zona', nombre: 'Zona (urbana / rural)', sinonimos: ['cole_area_ubicacion', 'area_ubicacion', 'zona_ubicacion', 'zona', 'area', 'ubicacion', 'estu_area_reside'] },
  { clave: 'jornada', nombre: 'Jornada', sinonimos: ['cole_jornada', 'jornada'] },
  { clave: 'genero', nombre: 'Sexo', sinonimos: ['estu_genero', 'genero', 'sexo'] },
  { clave: 'naturaleza', nombre: 'Sector (oficial / no oficial)', sinonimos: ['cole_naturaleza', 'naturaleza', 'sector'] },
  { clave: 'nse', nombre: 'Nivel socioeconómico (NSE)', sinonimos: ['estu_nse_individual', 'nse_individual', 'nivel_socioeconomico', 'nse', 'estu_nse_establecimiento', 'cole_nse_establecimiento'] },
  { clave: 'grupo', nombre: 'Grupo / curso', sinonimos: ['grupo', 'curso', 'salon', 'seccion', 'grado'] },
  { clave: 'lectura', nombre: 'Puntaje Lectura Crítica', numerico: true, sinonimos: ['punt_lectura_critica', 'puntaje_lectura_critica', 'lectura_critica', 'punt_lectura', 'lectura', 'lc'] },
  { clave: 'matematicas', nombre: 'Puntaje Matemáticas', numerico: true, sinonimos: ['punt_matematicas', 'puntaje_matematicas', 'matematicas', 'matematica', 'punt_mat', 'mat'] },
  { clave: 'sociales', nombre: 'Puntaje Sociales y Ciudadanas', numerico: true, sinonimos: ['punt_sociales_ciudadanas', 'puntaje_sociales_ciudadanas', 'sociales_y_ciudadanas', 'sociales_ciudadanas', 'competencias_ciudadanas', 'sociales'] },
  { clave: 'naturales', nombre: 'Puntaje Ciencias Naturales', numerico: true, sinonimos: ['punt_c_naturales', 'punt_ciencias_naturales', 'puntaje_ciencias_naturales', 'ciencias_naturales', 'c_naturales', 'naturales', 'ciencias'] },
  { clave: 'ingles', nombre: 'Puntaje Inglés', numerico: true, sinonimos: ['punt_ingles', 'puntaje_ingles', 'ingles'] },
  { clave: 'global', nombre: 'Puntaje Global', numerico: true, sinonimos: ['punt_global', 'puntaje_global', 'global', 'puntaje_total', 'total'] },
];

// Variables por las que se puede agrupar y comparar.
const DIMENSIONES = [
  { clave: 'anio', nombre: 'Año' },
  { clave: 'region', nombre: 'Región' },
  { clave: 'departamento', nombre: 'Departamento' },
  { clave: 'etc', nombre: 'ETC' },
  { clave: 'municipio', nombre: 'Municipio' },
  { clave: 'zona', nombre: 'Zona (urbana / rural)' },
  { clave: 'naturaleza', nombre: 'Sector' },
  { clave: 'nse', nombre: 'Nivel socioeconómico' },
  { clave: 'genero', nombre: 'Sexo' },
  { clave: 'colegio', nombre: 'Colegio' },
  { clave: 'sede', nombre: 'Sede' },
  { clave: 'jornada', nombre: 'Jornada' },
  { clave: 'grupo', nombre: 'Grupo / curso' },
];

// Regiones del país según el departamento del colegio (agrupación usada en los informes
// nacionales de análisis Saber 11). Los nombres van sin tildes y en mayúsculas.
const REGIONES = {
  'Caribe': ['ATLANTICO', 'BOLIVAR', 'CESAR', 'CORDOBA', 'LA GUAJIRA', 'GUAJIRA', 'MAGDALENA', 'SAN ANDRES', 'SAN ANDRES Y PROVIDENCIA', 'ARCHIPIELAGO DE SAN ANDRES', 'SUCRE'],
  'Eje Cafetero': ['ANTIOQUIA', 'CALDAS', 'QUINDIO', 'RISARALDA'],
  'Pacífico': ['CAUCA', 'CHOCO', 'NARIÑO', 'VALLE', 'VALLE DEL CAUCA'],
  'Central': ['BOGOTA', 'BOGOTA D.C.', 'BOGOTA DC', 'BOGOTA, D.C.', 'BOYACA', 'CUNDINAMARCA', 'HUILA', 'NORTE SANTANDER', 'NORTE DE SANTANDER', 'SANTANDER', 'TOLIMA'],
  'Amazonía': ['AMAZONAS', 'CAQUETA', 'GUAINIA', 'GUAVIARE', 'PUTUMAYO', 'VAUPES'],
  'Orinoquía': ['ARAUCA', 'CASANARE', 'META', 'VICHADA'],
};

function regionDe(departamento) {
  const d = String(departamento || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/N\u0303/g, 'Ñ').trim();
  if (!d) return '';
  for (const [region, deptos] of Object.entries(REGIONES)) {
    if (deptos.some((x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === d.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return region;
  }
  if (d.startsWith('BOGOTA')) return 'Central';
  if (d.startsWith('SAN ANDRES')) return 'Caribe';
  return '';
}

// Colores fijos para las categorías que se repiten en todos los informes.
const COLORES_CATEGORIA = {
  OFICIAL: '#2563eb', 'NO OFICIAL': '#f59e0b',
  URBANO: '#0891b2', RURAL: '#65a30d',
  F: '#db2777', M: '#2563eb',
  NSE1: '#dc2626', NSE2: '#f59e0b', NSE3: '#3b82f6', NSE4: '#16a34a',
};

// Fórmula oficial del puntaje global: promedio ponderado (inglés pesa 1, las demás 3) × 5.
function calcularGlobal(lectura, matematicas, sociales, naturales, ingles) {
  return Math.round(((lectura + matematicas + sociales + naturales) * 3 + ingles) / 13 * 5);
}

function nivelDe(area, valor) {
  if (valor == null) return null;
  let nivel = area.niveles[0].nombre;
  for (const n of area.niveles) if (valor >= n.min) nivel = n.nombre;
  return nivel;
}
