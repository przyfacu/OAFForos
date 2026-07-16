
  # OAFForos — diseño y plan del MVP

  ## Resumen

  Crear una beta pública de OAFForos para la comunidad de olimpíadas de física de
  Argentina: un foro académico de lectura abierta, con cuentas verificadas para
  participar, y un archivo navegable de problemas de competencias. La interfaz será
  académica y sobria, responsive, en español, construida con HTML, CSS y JavaScript sin
  framework; Supabase proveerá autenticación, PostgreSQL, almacenamiento de imágenes y
  permisos.

  ## Producto y experiencia

  - Separar claramente dos áreas principales:
      - Foro: debates y consultas por disciplinas de física, con temas, respuestas,
        etiquetas y búsqueda.

      - Archivo de problemas: navegación jerárquica tipo de competencia → competencia →
        edición/año → nivel → problema.

  - Cada problema del archivo tendrá su propio hilo asociado para discusión, pistas y
    soluciones. Las respuestas con spoilers permanecerán ocultas hasta que el lector
    decida revelarlas.

  - No habrá votos, “likes”, reputación ni soluciones destacadas. La corrección será
    comunitaria mediante respuestas y discusión.

  - Cualquier cuenta con email confirmado o acceso por Google podrá crear temas y
    respuestas. Visitantes no autenticados podrán leer.

  - Los miembros podrán proponer altas o cambios en el archivo; estas propuestas
    quedarán pendientes hasta la aprobación de un moderador.

  - Usar Markdown con LaTeX renderizado para enunciados, temas y respuestas. Admitir
    imágenes y enlaces externos, pero no carga directa de PDFs.

  - Incluir búsqueda unificada: texto en el foro y filtros de archivo por competencia,
    año, nivel y título.

  ## Arquitectura e interfaces

  - Inicializar un repositorio con documentación de diseño, guía de instalación,
    variables de entorno y una aplicación estática modular en JavaScript.

  - Integrar Supabase Auth con email/contraseña, confirmación de correo, recuperación de
    contraseña y OAuth con Google.

  - Modelar en PostgreSQL:
      - perfiles y roles (member, moderator, admin);
      - categorías, temas, respuestas, etiquetas, reportes y estados de moderación;
      - tipos de competencia, competencias, ediciones, niveles y problemas;
      - propuestas de cambio al archivo, con autor, estado, revisor y motivo de
        resolución;

      - relación uno-a-uno entre un problema publicado y su hilo asociado.

  - Aplicar políticas RLS: lectura pública del contenido publicado; escritura solo para
    cuentas autenticadas; edición limitada al autor; revisión, ocultamiento, cierre y
    administración del archivo solo para moderadores/administradores.

  - Sanitizar el Markdown antes de renderizarlo, restringir imágenes a tipos/tamaños
    seguros y renderizar LaTeX sin ejecutar HTML arbitrario.

  - Diseñar pantallas para inicio, listado y detalle del foro, creación/edición de tema,
    archivo jerárquico, ficha de problema, hilo asociado, búsqueda, perfil, acceso/
    registro, propuestas de archivo y consola de moderación.

  - Mantener la decisión de hosting del frontend para una fase posterior; dejar el
    proyecto listo para desplegarse en un proveedor estático compatible con variables de
    entorno.

  ## Entrega por etapas

  1. Fundación: repositorio, sistema visual sobrio, layout responsive, navegación,
     Supabase y autenticación.

  2. Foro: categorías, temas, respuestas, Markdown/LaTeX, etiquetas, spoilers, edición
     propia, reportes y búsqueda de discusiones.

  3. Archivo: jerarquía de competencias, fichas de problemas, hilo asociado, filtros y
     flujo de propuestas/revisión.

  4. Moderación y beta: roles, reportes, gestión de contenido, mensajes de estado,
     páginas legales básicas y datos iniciales de ejemplo.

  5. Preparación de lanzamiento: configuración del proyecto Supabase, dominio/hosting
     elegido, analítica respetuosa de privacidad y guía operativa para moderadores.

  ## Pruebas y aceptación

  - Verificar registro, confirmación, recuperación de contraseña y acceso por Google.
  - Comprobar que visitantes solo leen, miembros publican y editan lo propio, y
    moderadores pueden revisar propuestas y moderar contenido.

  - Validar navegación completa del archivo hasta un problema, apertura del hilo
    relacionado y ocultamiento/revelado de spoilers.

  - Cubrir renderizado seguro de Markdown y ecuaciones LaTeX, subida de imágenes
    permitidas y rechazo de archivos no admitidos.

  - Probar búsqueda y filtros combinados, estados vacíos/errores, accesibilidad básica
    por teclado y visualización móvil/escritorio.

  - Considerar listo el MVP cuando una persona pueda registrarse, discutir un problema,
    proponer una entrada al archivo y un moderador pueda aprobarla para hacerla pública.

  ## Supuestos fijados

  - El idioma inicial es español y el lanzamiento es una beta pública.
  - El archivo se curará mediante propuestas de miembros y revisión humana; no habrá
    importación automática de contenido.

  - La comunidad corregirá soluciones mediante conversación, sin sistema de valoración
    ni verificación editorial.

  - La futura evolución hacia red social, biblioteca de recursos o competencias queda
    fuera del MVP, pero el modelo de usuarios y contenido deberá permitirla.