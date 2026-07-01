# PulseStudio

Prototipo tecnico para validar el flujo base:

Crear curso -> renderizar curso web estatico -> empaquetar SCORM 1.2 -> subir a un LMS.

Este primer hito no busca ser una plataforma completa. Su objetivo es probar la pieza mas riesgosa del proyecto: la exportacion SCORM y el tracking minimo.

## Que incluye

- Un curso de ejemplo en JSON.
- Frontend de autoria en React + Vite + Tailwind CSS.
- Componentes accesibles con Radix UI e iconos con Lucide.
- Un runtime web estatico que lee `course-data.json`.
- Bloques: heading, paragraph, image-text, statement, embed, HTML custom, divider, continuar y preguntas tipo Rise.
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
      ui/
        main.tsx
        styles.css
      server.js
    runtime/
      index.html
      main.js
      styles.css
      scorm-api-wrapper.js
  scripts/
    export-scorm.ps1
  docs/
    scorm-mvp.md
```

## Como generar el ZIP SCORM

Desde PowerShell:

```powershell
.\scripts\export-scorm.ps1
```

Si Windows bloquea la ejecucion directa del script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-scorm.ps1
```

El resultado se genera en:

```text
dist/curso-demo-scorm.zip
```

## Como abrir la plataforma local

Desde la carpeta del proyecto:

```powershell
npm install
npm run build
npm start
```

Luego abre:

```text
http://localhost:4173
```

Desde esa pantalla puedes editar el curso, guardar los cambios y exportar nuevamente el ZIP SCORM.

Para desarrollo de interfaz tambien puedes usar Vite:

```powershell
npm run dev
```

Vite abre el frontend en `http://localhost:5173` y usa el servidor local `http://localhost:4173` como backend.

## Avance actual de la plataforma

La plataforma local ya permite:

- Editar datos generales del curso.
- Gestionar cursos desde dashboard.
- Guardar cursos en Supabase cuando las variables de entorno estan configuradas.
- Crear y ordenar lecciones.
- Crear y ordenar bloques.
- Editar textos con formato enriquecido.
- Embeber videos o recursos externos con opciones de tamano, proporcion y marco.
- Insertar HTML custom en un iframe aislado.
- Ver vista previa con panel lateral.
- Guardar el curso como JSON.
- Exportar SCORM 1.2 desde la interfaz.

## Como probarlo

1. Genera el ZIP con el script.
2. Sube `dist/curso-demo-scorm.zip` a Moodle u otro LMS compatible con SCORM 1.2.
3. Abre el curso como estudiante.
4. Avanza hasta el final.
5. Responde el quiz.
6. Verifica que el LMS registre avance, completitud y puntaje.

## Conexion con Supabase

1. En Supabase, abre el SQL Editor del proyecto PulseStudio.
2. Ejecuta el contenido de `supabase/schema.sql`.
3. Copia `.env.example` como `.env`.
4. En `.env`, completa:

```text
VITE_SUPABASE_URL=https://swjptigsplrexotqnhyu.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_publica
```

5. Reinicia Vite o vuelve a compilar.

Para GitHub Pages, crea estas repository variables en GitHub:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

La anon key de Supabase es publica por diseno cuando se usa con RLS. El schema actual deja CRUD abierto para el prototipo; cuando agreguemos usuarios/login, hay que reemplazar esas politicas por reglas por usuario u organizacion.

## Siguiente paso recomendado

El siguiente hito recomendado es profundizar la persistencia: usuarios, organizaciones, permisos por curso, plantillas visuales por bloque, temas de curso y banco de preguntas.
