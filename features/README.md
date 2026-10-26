# Features · Pet Garden

Documentación funcional del panel de administración de **Pet Garden** (pet shop y spa).
Cada archivo describe un módulo con: historia de usuario, reglas de negocio y escenarios en Gherkin (español).

| # | Archivo | Módulo | Acceso |
|---|---------|--------|--------|
| 01 | [01-login-y-navegacion.md](01-login-y-navegacion.md) | Login, menú, buscador general y perfil | Público / privado |
| 02 | [02-hoy.md](02-hoy.md) | Citas del día y "A quién buscar hoy" (recordatorios + WhatsApp) | Privado |
| 03 | [03-agendar-cita.md](03-agendar-cita.md) | Agendar cita con autocompletado, precio sugerido y baño medicado | Privado |
| 04 | [04-agenda.md](04-agenda.md) | Agenda: filtros, terminar, editar, cancelar y corregir servicio | Privado |
| 05 | [05-clientes-y-mascotas.md](05-clientes-y-mascotas.md) | Búsqueda, ficha, edición e historial | Privado |
| 06 | [06-catalogos.md](06-catalogos.md) | Razas y precios, guías, servicios/recordatorios y logo | Privado |
| 07 | [07-videos.md](07-videos.md) | Carrusel público, lista para deslizar, activar/desactivar y administrador | Público / privado |
| 08 | [08-reportes.md](08-reportes.md) | Resumen por fechas y descarga de Excel | Solo administrador |
| 09 | [09-usuarios-y-roles.md](09-usuarios-y-roles.md) | Roles (Administrador / Colaborador) y pantalla Usuarios | Solo administrador |
| 10 | [10-multinegocio.md](10-multinegocio.md) | DALU Vital: varios negocios, invitaciones, enlaces cortos, suscripción y pagos | Administrador / DALU |
| 11 | [11-sedes-y-planes.md](11-sedes-y-planes.md) | Planes (Esencial, Profesional, Premium), sedes, agenda y precios por sede | Administrador / DALU |

## Lenguajes y tecnologías

### Lenguajes

| Lenguaje | Dónde se usa |
|---|---|
| **HTML5** | Estructura del sitio (`index.html`) y de cada pantalla, que se genera desde JavaScript. Usa `<dialog>` para las ventanas emergentes |
| **CSS3** | Estilos (`estilos.css`): variables de color, Grid, Flexbox, diseño adaptable a celular (media queries) y tema claro/oscuro automático (`prefers-color-scheme`) |
| **JavaScript (ES2020+)** | Toda la lógica del sitio, sin framework ni compilación: módulos por pantalla, `async/await`, plantillas de texto |
| **SQL (PostgreSQL)** | Tablas, vistas, permisos por fila (RLS) y consultas de mantenimiento (`sql-v4` a `sql-v10`) |
| **PL/pgSQL** | Funciones y disparadores de la base: crear el servicio al terminar una cita, cancelar con registro, roles |
| **Gherkin (en español)** | Escenarios de estos features (`# language: es`: Característica, Escenario, Dado / Cuando / Entonces) |
| **Markdown** | Esta documentación |

### Frontend

| Tecnología | Uso |
|---|---|
| JavaScript puro (*vanilla*) | Sin React/Angular/Vue ni herramientas de compilación: los archivos se publican tal cual |
| SPA con rutas por *hash* | Una sola página; cada sección es `#/hoy`, `#/agendar`, `#/agenda`, `#/clientes`, `#/reportes`, `#/catalogos`, `#/videos`, `#/usuarios` |
| Componentes propios | Tabla con orden y filtros por columna, calendario en español, menú de acciones ⋯, avisos con "Deshacer", carrusel de videos |
| APIs del navegador | `Intl` (fechas y pesos en formato `es-CO`, zona `America/Bogota`), Fullscreen API (videos), `MutationObserver` (calendario automático), History API, `<dialog>` |
| Google Fonts | Tipografías **Fredoka** (títulos) y **Nunito** (texto) |

Archivos del sitio:

| Archivo | Contenido |
|---|---|
| `index.html` | Página base y carga de scripts |
| `config.js` | URL y clave pública de Supabase, nombre del negocio |
| `app.js` | Núcleo: login, recuperación de contraseña, roles, menú, utilidades, tablas, calendario, WhatsApp |
| `hoy.js` · `agendar.js` · `agenda.js` · `clientes.js` · `reportes.js` · `catalogos.js` · `sedes.js` · `usuarios.js` · `suscripcion.js` · `negocios.js` · `videos.js` (oculto) | Una pantalla cada uno |
| `estilos.css` | Todos los estilos |
| `sql-v*.sql` | Cambios de base de datos por versión |

### Backend (Supabase)

| Servicio | Uso |
|---|---|
| **PostgreSQL** | Base de datos: tablas, vistas, funciones y disparadores |
| **Supabase Auth** | Inicio de sesión con correo y contraseña, recuperación de contraseña por correo, nombre del usuario |
| **Row Level Security (RLS)** | Permisos dentro de la base: roles, nadie borra citas ni servicios, solo el administrador cambia precios y borra videos |
| **PostgREST (API REST)** y **RPC** | El sitio lee y escribe con `supabase-js`; las acciones delicadas usan funciones (`cancelar_cita`, `anular_servicio`, `registrar_cita`, `registrar_visita_anterior`) |
| **Supabase Storage** | Archivos públicos: *buckets* `logo` y `videos` |

### Librerías externas

| Librería | Versión | Cómo se carga | Uso |
|---|---|---|---|
| `@supabase/supabase-js` | 2.45.4 | CDN jsDelivr | Conexión con la base, Auth y Storage |
| SheetJS (`xlsx`) | 0.18.5 | CDN cdnjs, solo al descargar | Generar el Excel de Reportes |

### Servicios externos

| Servicio | Uso |
|---|---|
| **WhatsApp** (enlaces `wa.me`) | Recordatorios de regreso, recordatorio de cita y aviso de recogida (abre WhatsApp con el mensaje escrito) |
| **YouTube** (`youtube-nocookie.com`, `i.ytimg.com`) | Solo para reproducir los videos antiguos que se guardaron por enlace. Desde v13 los videos nuevos se suben únicamente como archivo |

### Publicación y control de versiones

| Herramienta | Uso |
|---|---|
| **Git** y **GitHub** | Repositorio `JessicavRamos/Agenda` |
| **GitHub Pages** | Hosting del sitio (estático, sin servidor propio) |
| **Dominio `dalu.pro`** (Namecheap) | Dominio de la marca **Dalu**, para conectarlo a GitHub Pages |

### Pruebas automáticas (v13, en el repositorio)

| Archivo | Uso |
|---|---|
| `package.json` | Dependencia `@playwright/test` y los comandos `npm test`, `npm run test:ver` (con el navegador a la vista) y `npm run test:reporte` |
| `playwright.config.js` | Configuración: zona `America/Bogota`, idioma `es-CO`, levanta el sitio solo con `node pruebas/servidor.js` |
| `pruebas/sitio.spec.js` | 16 pruebas: Hoy, celular sin desbordes, roles, catálogos, confirmaciones, clientes (+1.000), visita anterior, calendario con teclado, videos y respaldo |
| `pruebas/supabase-falso.js` | Supabase simulado en memoria (también simula los permisos del colaborador). **Las pruebas nunca tocan la base real** |
| `pruebas/servidor.js` | Servidor mínimo sin instalar nada |

Cómo correrlas en tu computador (una sola vez `npm install` y `npx playwright install chromium`; después solo `npm test`).

### Pruebas durante el desarrollo

| Herramienta | Uso |
|---|---|
| **Playwright** (Chromium) | Pruebas automáticas de la interfaz en computador (1300 px) y celular (390 px) contra una base simulada; capturas de pantalla |
| **PostgreSQL 16 local** | Validar cada SQL antes de entregarlo (ejecutarlo dos veces, permisos de colaborador y administrador, reglas automáticas) |
| **Node.js** | Revisar la sintaxis de cada archivo JavaScript y probar funciones sueltas (mensajes de WhatsApp, primer nombre) |
| Gherkin (estos features) | Base para automatizar después con Cypress + Cucumber |

### Otros datos técnicos

- **Zona horaria:** todas las fechas se calculan en `America/Bogota`.
- **Moneda:** pesos colombianos, formato `es-CO` (ej. `$30.000`).
- **Diseño adaptable:** computador y celular (desde 390 px), tema claro y oscuro según el dispositivo.
- **Configuración:** `config.js` → `SUPABASE_URL`, `SUPABASE_ANON_KEY` (clave pública), `NEGOCIO_POR_DEFECTO`, `NOMBRE_NEGOCIO`, `DALU_WHATSAPP` y `DALU_MEDIOS_PAGO` (Suscripción).

### Objetos de base de datos que usa el frontend

| Tipo | Nombre | Uso |
|------|--------|-----|
| Tabla | `clientes`, `mascotas`, `citas`, `servicios` | Datos principales |
| Tabla | `razas`, `guias`, `tipos_servicio`, `grupos_recordatorio`, `videos` (con `activo`) | Catálogos |
| Tabla | `pendientes_descartados` | Mascotas descartadas de "A quién buscar" en el ciclo actual |
| Tabla | `servicios_anulados` | Bitácora permanente de servicios realizados que se cancelaron (quién, cuándo, por qué) |
| Columnas | `citas.cancelada_por`, `cancelada_en`, `motivo_cancelacion` | Registro de quién canceló cada cita |
| RPC | `cancelar_cita`, `anular_servicio` | Cancelan con registro de "Nombre (correo)". Nadie puede borrar citas ni servicios |
| Función | `usuario_actual()` | Devuelve "Nombre (correo)" de quien inició sesión |
| Columna | `razas.precio_unas` | Precio de uñas por raza |
| Tabla | `perfiles` | Rol de cada usuario (administrador / empleado); se crea solo al crear el usuario |
| Función | `es_administrador()` | ¿Quien inició sesión es administrador? (la usan los permisos) |
| Vista | `agenda` | Citas con datos de mascota, cliente y servicio |
| Vista | `pendientes` | Mascotas que ya deben volver (con `dias_de_retraso`) |
| Vista | `mascotas_resumen` | Mascota + cliente + teléfonos + visitas + última visita |
| Vista | `historial` | Servicios realizados |
| Vista | `ultima_guia` | Última guía usada por mascota |
| Vista | `precios_sugeridos` | Precio habitual de la mascota o de la raza |
| RPC | `registrar_cita` | Crea la cita y, si no existen, el cliente y la mascota |
| Trigger | `trg_cita_realizada` en `citas` → `crear_servicio_al_completar()` | Al pasar la cita a `realizada` crea el servicio con la **fecha de la cita** (v7). No deja reabrir una realizada; solo permite pasarla a `cancelada` si su servicio ya está en la bitácora (v5) |
| Trigger | `trg_sincronizar_cita` en `servicios` → `sincronizar_cita_desde_servicio()` | Al corregir un servicio, copia sus datos (y su fecha) a la cita |
| Storage | `logo`, `videos` | Buckets públicos. Desde v13 solo el administrador sube o cambia el logo |
| RPC | `registrar_visita_anterior` (v13) | Crea una cita ya realizada en una fecha pasada y su servicio con esa misma fecha |
| Trigger | `trg_renombrar_grupo_descartes` en `grupos_recordatorio` (v13) | Si se renombra un grupo, los descartes de "A quién buscar" se renombran también |
| Permisos | `anon` (v13) | Sin sesión solo se puede leer la tabla `videos` (página pública). Todo lo demás exige iniciar sesión |

## Comportamiento común: tablas con orden y filtro

Las tablas de Agenda, Clientes y mascotas, Reportes y el administrador de Videos comparten este comportamiento:

```gherkin
# language: es
Característica: Ordenar y filtrar tablas por columna

  Escenario: Ordenar por una columna
    Cuando hago clic en el encabezado "Mascota"
    Entonces las filas se ordenan de A a Z y el encabezado muestra ▲
    Cuando vuelvo a hacer clic
    Entonces se ordenan de Z a A y muestra ▼
    Cuando hago clic una tercera vez
    Entonces vuelve al orden original y muestra ↕

  Escenario: Los vacíos van al final
    Cuando ordeno por "Última visita"
    Entonces las mascotas sin visitas aparecen al final en ambos sentidos

  Escenario: Filtrar por texto (sin importar tildes ni mayúsculas)
    Cuando escribo "simon" en el filtro de "Mascota"
    Entonces veo "Simón"
    Y debajo de la tabla dice "Mostrando 1 de N registros"

  Escenario: Filtrar por lista
    Cuando elijo "cancelada" en el filtro de "Estado"
    Entonces solo veo citas canceladas

  Escenario: Filtrar por fecha con calendario
    Cuando elijo un día en el filtro de "Fecha y hora" o "Última visita"
    Entonces solo veo los registros de ese día

  Escenario: El filtro se limpia si su valor desaparece
    Dado que filtré la columna "Servicio" por "Corte"
    Cuando ya no queda ninguna fila con "Corte"
    Entonces el filtro vuelve a "Todos"

  Escenario: Tablas en el celular
    Dado que abro el sitio en un celular
    Entonces cada fila se ve como una tarjeta con el nombre de cada dato a la izquierda
    Y los botones de orden se ven como botones pequeños arriba
    Y los filtros se acomodan en dos columnas con su nombre encima

  Escenario: Limpiar filtros
    Dado que filtré o ordené una tabla
    Entonces debajo aparece "✕ Limpiar filtros"
    Cuando lo presiono
    Entonces se borran todos los filtros y el orden, y veo todos los registros
    Y el botón se oculta

  Escenario: Orden y filtros se recuerdan
    Dado que ordené la Agenda por "Mascota"
    Cuando cambio de pantalla y vuelvo
    Entonces la tabla sigue ordenada por "Mascota"
```

## Calendario (v6)

Todos los campos de fecha del sitio usan un calendario propio, igual en computador y en celular.

```gherkin
# language: es
Característica: Calendario de fechas

  Escenario: Cómo se ve el campo
    Dado un campo de fecha con el 18/10/2026
    Entonces se ve "18/10/2026 · Dom" con un ícono de calendario

  Escenario: Elegir una fecha
    Cuando abro el calendario
    Entonces veo el mes en español, la semana de lunes a domingo y el día de hoy resaltado
    Cuando elijo el 5 de noviembre
    Entonces el campo muestra "05/11/2026 · Jue" y la pantalla se actualiza

  Escenario: Cambiar de mes
    Cuando presiono › en el calendario
    Entonces veo el mes siguiente

  Escenario: Botones Hoy y Borrar
    Cuando presiono "Hoy"
    Entonces se elige la fecha de hoy
    Y "Borrar" aparece solo en campos que pueden quedar vacíos (por ejemplo, filtros y reportes)

  Escenario: Campo vacío
    Dado el filtro de fecha sin elegir
    Entonces dice "Cualquier día"

  Escenario: Cerrar sin elegir
    Cuando presiono Esc o hago clic fuera del calendario
    Entonces se cierra sin cambiar la fecha
```

## Glosario

- **Guía:** número de la máquina usada para peluquear; se guarda para repetir el corte.
- **Baño medicado:** baño con otro champú; suma un recargo (normalmente $8.000 o $16.000 según el tamaño).
- **Grupo de recordatorio:** servicios que cuentan igual para calcular cuándo vuelve el cliente (ej. *Spa*: Baño, Corte, Corte y baño → 30 días).
- **Cliente inactivo:** no aparece en "A quién buscar", pero conserva su historial.

## Diseño para celular (v4)

```gherkin
# language: es
Característica: Uso en celular

  Escenario: Menú compacto
    Dado que abro el panel en un celular
    Entonces arriba veo el logo, el nombre del negocio y un botón con la sección actual y ☰
    Cuando lo toco
    Entonces se despliega el menú con todas las secciones, mi nombre y "Cerrar sesión"

  Escenario: Sin desplazamiento de lado
    Cuando recorro cualquier pantalla en un celular de 390 px de ancho
    Entonces nada se sale de la pantalla hacia los lados

  Escenario: Sin zoom al escribir (iPhone)
    Cuando toco cualquier campo
    Entonces el iPhone no agranda la página
```

## Historial de versiones

- **v16 · Suscripción de marketing:** Suscripción muestra el valor y no el gasto (plan, cliente desde, renovación, lo logrado en el mes, cómo pagar, comparador para mejorar el plan); estados amables de renovación; aviso en Hoy 3 días antes; aviso con «Quiero mejorar mi plan» al llegar al límite de usuarios o sedes; el plan Básico se llama **Esencial** y los nombres se editan en el panel DALU. SQL: `sql-v16-suscripcion-marketing.sql`.
- **v15 · Planes, sedes y suscripción:** tres planes con límites y módulos; varias sedes con agenda y precios por sede; Videos oculto; Reportes desplegables y filtro por sede; el administrador ya no ve valores pagados. SQL: `sql-v12` a `sql-v15`.
- **v14 · DALU Vital:** varios negocios en una sola base, invitaciones, enlaces cortos (`vital.dalu.pro/petgarden`), panel Negocios · DALU y pagos de la suscripción. SQL: `sql-v11-multinegocio.sql`.
- **v13 (revisión de código):** sin sesión ya no se pueden leer los datos (solo los videos); servicios, recordatorios y logo solo los cambia el administrador (guías siguen para todos); al renombrar un grupo no reaparecen los descartados; todas las pantallas avisan si la base no dejó guardar; sin límites fijos (Agenda → Buscar trae todas las citas, Clientes todas las mascotas, la ficha todo el historial con el total correcto); ventana propia de confirmación en vez de la del navegador; calendario con teclado; fechas en un solo formato (dd/mm/aaaa); videos nuevos solo como archivo; **Registrar visita anterior**; **respaldo completo** en Reportes; título "Pet Garden"; pruebas automáticas en el repositorio. SQL: `sql-v10-seguridad-y-visitas.sql`.
- **v12:** el rol "empleado" se muestra como "Colaborador".
- **v11:** solo el administrador cambia razas y precios (el empleado los ve en modo lectura); segundo administrador.
- **v10:** roles administrador y empleado; pantalla Usuarios; Reportes solo para el administrador; solo el administrador borra videos.
- **v9:** botón "Recordar" para enviar por WhatsApp el recordatorio de citas pendientes (nombre, mascota, servicio, día y hora); mensajes en 3 renglones.
- **v8:** los mensajes de WhatsApp usan solo el primer nombre del dueño.
- **v7:** al terminar una cita el servicio guarda la fecha de la cita (no la del día en que se terminó); corrección de los servicios guardados con fecha equivocada.
- **v6:** el centro del navegador de la Agenda dice el día que se ve, con "Volver a hoy"; se quitó "Agendar para este día"; servicio Uñas con precio por raza; sin columna "Recargo medicado"; calendario propio en todos los campos de fecha; cancelaciones con nombre y correo; aviso si se pide recuperar contraseña con el sitio abierto como archivo.
- **v5:** Agenda reorganizada (Día / 7 días / Buscar, resumen, canceladas recogidas), botón "Limpiar filtros", mensajes de WhatsApp sin emojis, cancelar repetido sin error.
- **v4:** cancelar en vez de eliminar, con registro de quién, cuándo y por qué (bitácora permanente), botones compactos con menú ⋯, filtro de fecha con calendario y formato dd/mm/aaaa, diseño para celular.
- **v3:** recuperar contraseña, descartar pendientes, avisar recogida por WhatsApp, eliminar citas/servicios, tablas ordenables y filtrables, historial en Agendar, lista y activación de videos, pantalla completa sin recortes, Reportes con Excel, colores de listas desplegables.

## Próximas mejoras (aún no implementadas)

- Renombrar "Catálogos" a "Configuración" en el menú.
- Cambiar el texto del recordatorio de WhatsApp por el mensaje oficial de Pet Garden (grupo *Spa*), sin emojis.
