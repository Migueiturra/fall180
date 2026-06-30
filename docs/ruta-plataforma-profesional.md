# Ruta hacia una plataforma profesional

## Estado actual

El proyecto ya tiene tres piezas funcionales:

- Editor local de cursos.
- Formato de curso en JSON.
- Exportador SCORM 1.2 validado en LMS.

Esto confirma que la base tecnica es correcta. La proxima etapa debe convertir el prototipo en una plataforma mantenible.

## Prioridades recomendadas

### 1. Mejorar capacidades de edicion

Funciones cercanas:

- Texto enriquecido: listo en primera version.
- Embed de videos/recursos externos: listo en primera version.
- HTML custom aislado en iframe: listo en primera version.
- Colores institucionales por tema.
- Bloque de imagen con posicion izquierda/derecha.
- Bloque de cita.
- Bloque de tarjetas.
- Bloque sorting.
- Quiz con mas configuraciones.

### 2. Separar datos, runtime y editor

El proyecto deberia mantener tres fronteras:

- Editor: crea y modifica cursos.
- Course schema: define el formato del curso.
- Runtime SCORM: reproduce el curso exportado.

Esto evita que una mejora visual del editor rompa el curso exportado.

### 3. Agregar base de datos

Cuando el editor ya sea comodo, el siguiente salto es guardar cursos en una base de datos.

Opcion recomendada para avanzar rapido:

- PostgreSQL.
- Supabase para autenticacion, base de datos y storage.

Modelo inicial:

```text
users
  id
  name
  email
  role

courses
  id
  owner_id
  title
  description
  status
  theme_json
  scorm_config_json
  created_at
  updated_at

lessons
  id
  course_id
  title
  order_index

blocks
  id
  lesson_id
  type
  content_json
  settings_json
  order_index

assets
  id
  course_id
  url
  file_type
  original_name
  size

exports
  id
  course_id
  format
  version
  zip_url
  status
  created_at
```

### 4. Versionado

Antes de usar la plataforma en produccion conviene agregar:

- Version del curso.
- Historial de exportaciones.
- Duplicar curso.
- Restaurar version anterior.

### 5. Roles

Roles minimos:

- Administrador.
- Autor.
- Revisor.

### 6. Plantillas

Cuando existan varios bloques, conviene agregar:

- Plantillas de curso.
- Plantillas de leccion.
- Plantillas de bloques.
- Temas visuales institucionales.

## Proximo hito sugerido

Agregar el bloque `sorting`, porque es una interaccion concreta tipo Rise 360 y permite validar que el motor soporta actividades mas complejas que un quiz simple.
