# Importar cursos desde CSV

PulseStudio puede crear un curso base desde un CSV. Cada fila representa un bloque.
El importador acepta archivos separados por coma `,` o punto y coma `;`.

## Columnas recomendadas

```csv
curso,descripcion_curso,unidad,orden,tipo,titulo,contenido,opciones,respuesta_correcta,obligatorio
```

## Tipos soportados

- `titulo`
- `parrafo`
- `statement`
- `lista`
- `acordeon`
- `embed`
- `html`
- `pregunta_unica`
- `multiple`
- `completar`
- `coincidencia`
- `continuar`
- `separador`

## Ejemplo

```csv
curso,descripcion_curso,unidad,orden,tipo,titulo,contenido,opciones,respuesta_correcta,obligatorio
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Bienvenida,1,titulo,,Gestion emocional en el trabajo,,,
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Bienvenida,2,parrafo,,Aprenderas a reconocer emociones y responder con mayor claridad.,,,
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Bienvenida,3,statement,,Entre lo que sentimos y lo que hacemos puede existir una pausa.,,,
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Modulo 1,1,lista,Ideas clave,,Reconocer senales|Pausar|Elegir una respuesta,,
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Modulo 1,2,pregunta_unica,Que ayuda a regular una emocion?,,Ignorarla|Nombrarla|Descargarla con otros,Nombrarla,si
Gestion emocional en el trabajo,Curso breve para practicar regulacion emocional,Modulo 1,3,continuar,Continuar,,,,
```

## Indicaciones para IA

Puedes pedir:

> Crea un curso en formato CSV para PulseStudio usando las columnas `curso,descripcion_curso,unidad,orden,tipo,titulo,contenido,opciones,respuesta_correcta,obligatorio`. Usa `|` para separar alternativas o items. No agregues explicaciones fuera del CSV.
