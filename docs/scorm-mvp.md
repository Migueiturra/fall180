# SCORM MVP

## Objetivo

Validar que un curso construido como JSON puede exportarse como un paquete SCORM 1.2 y reportar informacion minima a un LMS.

## Alcance inicial

El MVP debe reportar:

- Estado del curso: `incomplete`, `completed`, `passed` o `failed`.
- Puntaje: `cmi.core.score.raw`.
- Ubicacion actual: `cmi.core.lesson_location`.
- Estado interno minimo: `cmi.suspend_data`.

## Flujo de ejecucion

1. El LMS abre `index.html`.
2. El runtime busca la API SCORM 1.2.
3. El curso llama `LMSInitialize("")`.
4. El usuario avanza por las lecciones.
5. El runtime actualiza progreso y puntaje.
6. El curso llama `LMSCommit("")`.
7. Al cerrar, llama `LMSFinish("")`.

## Validacion recomendada

Primero probar en Moodle con SCORM 1.2.

Validar:

- El ZIP se reconoce como SCORM.
- El curso abre correctamente.
- El avance se mantiene al cerrar y volver a entrar.
- El estado cambia a completado al visitar todas las lecciones.
- El puntaje se registra despues de responder el quiz.

## Criterio de exito

El prototipo se considera validado cuando el LMS muestra:

- Curso iniciado.
- Curso completado.
- Puntaje registrado.
- Reanudacion desde la ultima leccion.

