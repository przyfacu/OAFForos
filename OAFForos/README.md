# OAFForos

Beta pública para la comunidad argentina de olimpíadas de física. El cliente está hecho con HTML, CSS y JavaScript nativo; Supabase aporta autenticación, PostgreSQL y almacenamiento de imágenes.

## Inicio rápido

1. Cree un proyecto en Supabase y ejecute [`supabase/schema.sql`](supabase/schema.sql), luego [`supabase/delete_user_and_content.sql`](supabase/delete_user_and_content.sql) y finalmente [`supabase/ban_deleted_users.sql`](supabase/ban_deleted_users.sql) en el SQL Editor.
2. Copie `js/config.example.js` a `js/config.js` y complete la URL y clave pública del proyecto.
3. Active los proveedores **Email** y **Google** en Authentication de Supabase. Configure las URL de redirección de su entorno y de producción.
4. Sirva esta carpeta con cualquier servidor estático, por ejemplo: `python3 -m http.server 8080`.

La guía detallada de creación del proyecto, autenticación y verificación está en
[`docs/SUPABASE.md`](docs/SUPABASE.md).

Sin configurar Supabase, el sitio se abre con contenido demostrativo de solo lectura para facilitar el diseño y las pruebas visuales.

Si el proyecto ya estaba creado antes de incorporar problemas teóricos y experimentales, ejecute una vez [`supabase/add_problem_kind.sql`](supabase/add_problem_kind.sql).

## Estructura

- `index.html`, `css/`, `js/`: interfaz estática modular.
- `supabase/schema.sql`: modelo de datos, funciones y políticas de seguridad RLS.
- `docs/DISENO.md`: alcance, decisiones de producto y operación de la beta.

## Moderación

El primer administrador se asigna directamente en la tabla `profiles` tras registrarse. Los administradores pueden asignar los roles `moderator` y `primex_admin` (mostrado como **Primex del admin**) desde la consola; ambos tienen los mismos permisos. Nunca exponga la clave `service_role` en el navegador.
