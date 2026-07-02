# Supabase Auth para PulseStudio

## 1. Aplicar esquema

En Supabase, abre SQL Editor y ejecuta `supabase/schema.sql`.

El esquema crea:

- `profiles`: datos basicos del usuario y rol (`user` o `super_admin`).
- `courses.owner_id`: relaciona cursos con su propietario.
- RLS para que cada usuario vea/edite sus cursos.
- Politicas de Storage para que cada usuario suba archivos a su carpeta.
- Bucket publico `course-assets` para que las imagenes funcionen en preview y SCORM.

## 2. Crear el super admin

Primero registrate en la app con tu correo real. Luego ejecuta en SQL Editor:

```sql
update public.profiles
set role = 'super_admin'
where email = 'tu-correo@dominio.cl';
```

Desde ese momento ese usuario podra ver y administrar cursos/perfiles segun las politicas.

## 3. Activar Google

En Supabase:

1. Ve a Authentication > Providers.
2. Activa Google.
3. Carga Client ID y Client Secret desde Google Cloud Console.
4. Agrega como redirect URL los dominios de trabajo:
   - `http://localhost:5173`
   - `http://localhost:4173`
   - `https://migueiturra.github.io/fall180/`

En Google Cloud Console agrega el callback de Supabase:

```txt
https://TU-PROYECTO.supabase.co/auth/v1/callback
```

## 4. Variables de GitHub Pages

En GitHub > Settings > Secrets and variables > Actions > Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

La anon key puede estar en frontend porque la seguridad real esta en RLS.

## 5. Migracion de cursos antiguos

Si hay cursos creados antes de `owner_id`, asignales propietario:

```sql
update public.courses
set owner_id = (select id from public.profiles where email = 'tu-correo@dominio.cl')
where owner_id is null;
```
