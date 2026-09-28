# Análisis Saber 11

Aplicación web para analizar los resultados de las pruebas Saber 11 a partir de archivos Excel o CSV.
Todo se procesa en el navegador: los datos de los estudiantes no se envían a ningún servidor.

## Acceso

Al abrir la app aparece una pantalla de acceso. La primera vez se crea una contraseña (se guarda cifrada solo en ese navegador); después se ingresa con ella. "Salir" borra de la memoria los datos cargados. Si se olvida la contraseña, se puede borrar y crear una nueva.

## Qué hace

1. **Cargar**: uno o varios archivos (.xlsx, .xls, .csv), por ejemplo uno por año o por colegio. Reconoce solo la fila de encabezados y las columnas del ICFES (`PUNT_MATEMATICAS`, `PUNT_GLOBAL`, `COLE_NOMBRE_ESTABLECIMIENTO`, `PERIODO`, `COLE_DEPTO_UBICACION`, `COLE_MCPIO_UBICACION`, `COLE_AREA_UBICACION`, `ESTU_NSE_INDIVIDUAL`…). Se puede corregir el reconocimiento a mano y asignar año, colegio, municipio o zona a archivos que no los traen.
2. **Limpiar**: quita títulos, filas vacías, totales y encabezados repetidos; normaliza textos, sexo, zona (URBANO / RURAL), sector (OFICIAL / NO OFICIAL) y NSE (NSE1–NSE4); convierte puntajes escritos como texto ("58,0", "47 pts"); vacía valores no numéricos o fuera de rango; elimina duplicados; calcula el puntaje global faltante con la fórmula oficial y avisa si un global no coincide con las áreas. Muestra cada corrección y permite descargar los datos limpios.
3. **Estadísticas**: promedio, IC 95%, mediana, desviación, cuartiles, coeficiente de variación y niveles de desempeño por área.
4. **Gráficos**: promedios, histogramas, niveles, promedio por grupo, evolución por año y dispersión. Se descargan como PNG.
5. **Comparar**: por año, colegio, municipio, zona urbana / rural, jornada, género, etc.; tabla cruzada (colegio × año) con cambio entre años; prueba t de Welch con tamaño del efecto.
6. **Correlaciones**: matriz Pearson o Spearman entre pruebas, por estudiante o por promedios de colegio, con gráfico y recta de tendencia.
7. **Informe**: sigue la estructura del documento de referencia "Análisis de resultados examen Saber 11°":
   portada, tabla de contenido, contexto y hallazgos; 1. puntajes promedio (global, evaluados y por área);
   2. brechas educativas (NSE, sector, zona, sexo y sus cruces); 3. niveles de desempeño por prueba;
   4. resultados por territorio (departamento, ETC, municipio o colegio, con regiones, variaciones, aporte por prueba,
   brechas de sector, zona y género); 5. conclusiones; anexos (NSE y nota metodológica).
   Los textos se redactan solos a partir de los datos. Se imprime o guarda en PDF y se exporta a Excel.

Botón **"Probar con datos de ejemplo"**: carga datos ficticios de 10 colegios de 3 departamentos y 5 municipios, años 2021–2025, con errores a propósito para ver la limpieza.

## Cómo usarla

- **En línea**: publicar el repositorio en Vercel (o GitHub Pages). Es un sitio estático, no necesita configuración.
- **En su computador**: abrir `index.html` en el navegador.

## Archivos

- `index.html`, `css/estilos.css`: página y estilos.
- `js/config.js`: áreas, **puntos de corte de los niveles de desempeño** y nombres de columnas reconocidos (ajustar aquí si el ICFES los cambia).
- `js/datos.js`: lectura de archivos y limpieza.
- `js/estadistica.js`: cálculos estadísticos.
- `js/app.js`: pantallas y gráficos.
- `js/informe.js`: informe estructurado.
- `js/acceso.js`: pantalla de acceso.
- `js/vendor/`: librerías SheetJS (Excel) y Chart.js (gráficos), incluidas para que funcione sin internet.
