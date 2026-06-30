# Authoring SCORM Builder MVP

Prototipo tecnico para validar el flujo base:

Crear curso -> renderizar curso web estatico -> empaquetar SCORM 1.2 -> subir a un LMS.

Este primer hito no busca ser una plataforma completa. Su objetivo es probar la pieza mas riesgosa del proyecto: la exportacion SCORM y el tracking minimo.

## Que incluye

- Un curso de ejemplo en JSON.
- Un runtime web estatico que lee `course-data.json`.
- Bloques: heading, paragraph, image-text, embed, HTML custom, divider y quiz simple.
- Editor de texto enriquecido para contenido: negrita, cursiva, subrayado y colores.
- Sistema visual interno para una interfaz mas pulida sin depender de CDN.
- Tracking SCORM 1.2 basico:
  - `cmi.core.lesson_status`
  - `cmi.core.score.raw`
  - `cmi.core.lesson_location`
  - `cmi.suspend_data`
- Script de exportacion a ZIP SCORM 1.2.

## Estructura

```text
authoring-scorm-builder-mvp/
  course/
    course-data.json
  src/
    app/
      server.js
      public/
    runtime/
      index.html
      main.js
      styles.css
      scorm-api-wrapper.js
  scripts/
    export-scorm.ps1
  docs/
    scorm-mvp.md
    ruta-plataforma-profesional.md
```

## Como abrir la plataforma local

Con Node.js instalado, desde la carpeta del proyecto:

```powershell
npm run start
```

Luego abre:

```text
http://localhost:4173
```

Desde esa pantalla puedes editar el curso, guardar los cambios y exportar nuevamente el ZIP SCORM.

## Como generar el ZIP SCORM

Desde PowerShell:

```powershell
.\scripts\export-scorm.ps1
```

O mediante npm:

```powershell
npm run export:scorm
```

El resultado se genera en:

```text
dist/curso-demo-scorm.zip
```

## Avance actual de la plataforma

La plataforma local ya permite:

- Editar datos generales del curso.
- Crear y ordenar lecciones.
- Crear y ordenar bloques.
- Editar textos con formato enriquecido.
- Embeber videos o recursos externos con opciones de tamano, proporcion y marco.
- Insertar HTML custom en un iframe aislado.
- Ver vista previa.
- Guardar el curso como JSON.
- Exportar SCORM 1.2 desde la interfaz.

## Como probarlo

1. Genera el ZIP con el script.
2. Sube `dist/curso-demo-scorm.zip` a Moodle u otro LMS compatible con SCORM 1.2.
3. Abre el curso como estudiante.
4. Avanza hasta el final.
5. Responde el quiz.
6. Verifica que el LMS registre avance, completitud y puntaje.

## Siguiente paso recomendado

Agregar el bloque `sorting`, porque es una interaccion concreta tipo Rise 360 y permite validar que el motor soporta actividades mas complejas que un quiz simple.
