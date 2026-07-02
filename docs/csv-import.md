# Importar cursos desde CSV

PulseStudio puede crear un curso base desde un CSV. Cada fila representa un bloque editable.
El importador acepta archivos separados por coma `,` o punto y coma `;`.

## Columnas recomendadas

```csv
curso,descripcion_curso,unidad,orden,tipo,titulo,contenido,opciones,respuesta_correcta,obligatorio,imagen,extra,padding,ancho,alinear,color_fondo
```

Las columnas extras son opcionales. Si no existen, PulseStudio usa valores por defecto.

## Tipos soportados

- `titulo`
- `parrafo`
- `imagen_texto`
- `imagen` o `carrusel`
- `statement`
- `tarjetas`
- `tabs`
- `acordeon`
- `lista`
- `embed`
- `html`
- `pregunta_unica`
- `multiple`
- `completar`
- `coincidencia`
- `continuar`
- `separador`

## Separadores internos

Usa `|` para separar elementos dentro de una celda.

Usa `=>` para pares:

- Tarjetas: `Frente=>Reverso`
- Tabs: `Nombre tab=>Contenido`
- Acordeon: `Titulo=>Texto desplegable`
- Coincidencia: `Concepto=>Respuesta`

## Opciones visuales opcionales

- `padding`: `ninguno`, `pequeno`, `mediano`, `grande`
- `ancho`: `s`, `m`, `l`
- `alinear`: `izquierda`, `centro`, `derecha`
- `color_fondo`: hexadecimal, por ejemplo `#F6F6FF`
- `marco`: `si` o `no`, para imagenes, embed y HTML

## Columnas especificas utiles

- `imagen`: URL de imagen. En carrusel puede usar varias URLs separadas por `|`.
- `tamano_imagen`: ancho en px para `imagen_texto`.
- `alto`: alto en px para imagenes, tarjetas o HTML.
- `columnas`: cantidad de tarjetas, entre 1 y 3.
- `color_frente`, `color_reverso`: fondos de tarjetas.
- `color_acento`, `color_tabs`, `color_panel`: colores para tabs.
- `color_boton`, `tamano`: opciones del boton continuar.
- `ancho_px`: ancho fijo para HTML custom.

## Ejemplo completo

```csv
curso,descripcion_curso,unidad,orden,tipo,titulo,contenido,opciones,respuesta_correcta,obligatorio,imagen,extra,padding,ancho,alinear,color_fondo
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Bienvenida,1,titulo,,Gestion emocional en el trabajo,,,,,,mediano,m,izquierda,
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Bienvenida,2,parrafo,,Aprenderas a reconocer emociones y responder con mayor claridad.,,,,,,mediano,m,izquierda,
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Bienvenida,3,statement,,Entre lo que sentimos y lo que hacemos puede existir una pausa.,,,,,,grande,m,centro,#F6F6FF
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Modulo 1,1,imagen_texto,Senales tempranas,Observa cambios en respiracion tono y velocidad.,,,,https://example.com/imagen.jpg,,mediano,m,izquierda,
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Modulo 1,2,lista,Ideas clave,,Reconocer senales|Pausar|Elegir una respuesta,,,,,mediano,m,izquierda,
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Modulo 1,3,tarjetas,Tarjetas de practica,,Reconocer=>Nombrar lo que ocurre|Regular=>Elegir una respuesta mas util|Pedir apoyo=>Activar una red segura,,,,,mediano,l,centro,
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Modulo 1,4,tabs,Estrategias,,Respirar=>Haz una pausa breve antes de responder|Nombrar=>Ponle nombre a la emocion|Actuar=>Elige una accion proporcional,,,,,mediano,l,centro,
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Modulo 1,5,pregunta_unica,Que ayuda a regular una emocion?,,Ignorarla|Nombrarla|Descargarla con otros,Nombrarla,si,,,mediano,m,izquierda,
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Modulo 1,6,continuar,Continuar,,,,,,,,,
```

## Indicacion para IA

Puedes pedir:

> Crea un curso en formato CSV para PulseStudio usando las columnas `curso,descripcion_curso,unidad,orden,tipo,titulo,contenido,opciones,respuesta_correcta,obligatorio,imagen,extra,padding,ancho,alinear,color_fondo`. Usa `|` para separar alternativas o items y `=>` para pares en tarjetas, tabs, acordeon o coincidencia. No agregues explicaciones fuera del CSV.
