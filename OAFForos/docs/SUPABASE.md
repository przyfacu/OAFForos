# Puesta en marcha con Supabase

## 1. Crear el proyecto

1. Cree un proyecto nuevo en [Supabase](https://supabase.com/dashboard).
2. En **SQL Editor**, abra una consulta nueva, copie todo el contenido de
   `supabase/schema.sql` y ejecútelo una sola vez. Esto crea las tablas,
   funciones, políticas RLS y las categorías iniciales.

## 2. Configurar autenticación

En **Authentication > Providers**:

- Active **Email**. Para la prueba inicial se recomienda mantener la
  confirmación por correo habilitada.
- Active **Google** solo después de crear las credenciales OAuth de Google e
  indicar allí el client ID y el client secret.

En **Authentication > URL Configuration**, agregue como URLs de redirección:

- `http://localhost:8080/**` para desarrollo con `python3 -m http.server 8080`.
- La URL exacta del sitio de producción cuando se publique.

## 3. Conectar el cliente

En **Project Settings > API**, copie la **Project URL** y la clave
**Publishable** (o `anon`, si el proyecto aún muestra esa denominación). En
`js/config.js` complete:

```js
export const SUPABASE_URL = "https://<project-ref>.supabase.co";
export const SUPABASE_ANON_KEY = "<publishable-o-anon-key>";
```

La clave pública puede estar en el navegador: las políticas RLS del esquema
son las que protegen los datos. Nunca use ni copie la clave `service_role` en
este archivo.

## 4. Cargar el primer administrador

1. Registre una cuenta desde la aplicación y confirme el correo, si está
   habilitada la confirmación.
2. En **Table Editor > profiles**, localice esa cuenta y cambie `role` a
   `admin`.
3. Desde entonces, ese administrador puede asignar `moderator` a otros
   perfiles desde el panel de Supabase.

## 5. Verificación mínima

Con el sitio servido localmente, compruebe:

1. La portada deja de indicar “Modo demostración”.
2. Se ven las seis categorías iniciales en el foro.
3. Una cuenta registrada puede crear un tema y enviar una propuesta al archivo.
4. Un visitante puede leer contenido publicado, pero no puede crear contenido.
5. Un usuario miembro no puede cambiar su propio rol ni leer propuestas ajenas.

Si una consulta falla, abra la consola del navegador y copie el mensaje de
error junto con la operación realizada; suele indicar directamente la tabla o
política que hay que ajustar.

## 6. Configurar Storage para adjuntos

Para habilitar la subida de imágenes, PDFs y archivos en temas, respuestas y problemas:

1. En el **SQL Editor**, ejecute el contenido de `supabase/storage_attachments.sql`.
   Esto crea el bucket `attachments` con:
   - **Lectura pública** (cualquier visitante puede ver imágenes y descargar archivos).
   - **Escritura** solo para usuarios autenticados.
   - **Borrado** solo para el propietario del archivo.
   - **Límite de 10 MB** por archivo.
   - Tipos permitidos: imágenes, PDF, Word, Excel, PowerPoint, TXT, ZIP, RAR.

2. Opcionalmente en **Storage > Policies**, verifique que las tres políticas
   `attachments_*` estén activas en el bucket `attachments`.

Si el proyecto ya tenía adjuntos configurados, ejecute también una vez
`supabase/fix_attachments_rls.sql`. Reemplaza una política antigua e insegura
que permitía a cualquier usuario autenticado borrar metadatos de adjuntos
ajenos.

> **Nota**: Los adjuntos se guardan bajo rutas como `topic/<id>/...`,
> `reply/<id>/...`. En modo demostración (sin Supabase), las imágenes se
> previsual­izas usando `object URL` locales y no se persisten.

## 7. Migraciones de la interfaz de moderación

Ejecute una vez `supabase/delete_user_and_content.sql` desde SQL Editor. Es
necesario en todos los proyectos para que la eliminación desde la consola
borre de forma atómica la cuenta de Auth, el perfil y el contenido.

Si el proyecto ya existía antes de que se agregara la auditoría de moderación,
ejecute también `supabase/moderation_update.sql` para registrar quién y cuándo
moderó un tema.

El script de eliminación sólo permite invocar la operación a moderadores y
administradores y no permite eliminar administradores desde la interfaz.
