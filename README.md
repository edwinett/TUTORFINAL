# Análisis Saber 11

Aplicación web para analizar los resultados de las pruebas Saber 11 a partir de archivos Excel o CSV.
Todo se procesa en el navegador: los datos de los estudiantes no se envían a ningún servidor.

## Qué hace

1. **Cargar**: uno o varios archivos (.xlsx, .xls, .csv), por ejemplo uno por año o por colegio. Reconoce solo la fila de encabezados y las columnas del ICFES (`PUNT_MATEMATICAS`, `PUNT_GLOBAL`, `COLE_NOMBRE_ESTABLECIMIENTO`, `PERIODO`…). Se puede corregir el reconocimiento a mano y asignar año o colegio a archivos que no los traen.
2. **Limpiar**: quita títulos, filas vacías, totales y encabezados repetidos; normaliza textos y género; convierte puntajes escritos como texto ("58,0", "47 pts"); vacía valores no numéricos o fuera de rango; elimina duplicados; calcula el puntaje global faltante con la fórmula oficial y avisa si un global no coincide con las áreas. Muestra cada corrección y permite descargar los datos limpios.
3. **Estadísticas**: promedio, IC 95%, mediana, desviación, cuartiles, coeficiente de variación y niveles de desempeño por área.
4. **Gráficos**: promedios, histogramas, niveles, promedio por grupo, evolución por año y dispersión. Se descargan como PNG.
5. **Comparar**: por año, colegio, jornada, género, etc.; tabla cruzada (colegio × año) con cambio entre años; prueba t de Welch con tamaño del efecto.
6. **Correlaciones**: matriz Pearson o Spearman entre pruebas, por estudiante o por promedios de colegio, con gráfico y recta de tendencia.
7. **Informe**: informe imprimible / PDF con conclusiones automáticas, y exportación de todos los resultados a Excel.

Botón **"Probar con datos de ejemplo"**: carga datos ficticios de 3 colegios y 3 años, con errores a propósito para ver la limpieza.

## Cómo usarla

- **En línea**: publicar el repositorio en Vercel (o GitHub Pages). Es un sitio estático, no necesita configuración.
- **En su computador**: abrir `index.html` en el navegador.

## Archivos

- `index.html`, `css/estilos.css`: página y estilos.
- `js/config.js`: áreas, **puntos de corte de los niveles de desempeño** y nombres de columnas reconocidos (ajustar aquí si el ICFES los cambia).
- `js/datos.js`: lectura de archivos y limpieza.
- `js/estadistica.js`: cálculos estadísticos.
- `js/app.js`: pantallas, gráficos e informe.
- `js/vendor/`: librerías SheetJS (Excel) y Chart.js (gráficos), incluidas para que funcione sin internet.
