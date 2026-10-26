// Pruebas automáticas de DALU Vital (Playwright).
// Supabase y la librería de Excel se reemplazan por versiones falsas: NO se toca tu base real.
const { test, expect } = require("@playwright/test");
const path = require("path");

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
const EXCEL_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
// Excel falso: guarda en window.__excel las hojas que se iban a descargar.
const EXCEL_FALSO = `window.XLSX = { utils: {
  book_new: () => ({ SheetNames: [], Sheets: {} }),
  aoa_to_sheet: (filas) => ({ filas }), json_to_sheet: (filas) => ({ filas }),
  book_append_sheet: (libro, hoja, nombre) => { libro.SheetNames.push(nombre); libro.Sheets[nombre] = hoja; },
  sheet_add_aoa: () => {}, encode_cell: () => "A1", decode_range: () => ({ s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }), encode_range: () => "A1:A1",
}, writeFile: (libro, nombre) => { window.__excel = { nombre, hojas: libro.SheetNames }; } };`;

// Abre el sitio como administrador (por defecto) o como colaborador.
async function abrir(page, ruta, { colaborador = false, extra = "" } = {}) {
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.route(SUPABASE_CDN, (r) => r.fulfill({ path: path.join(__dirname, "supabase-falso.js"), contentType: "text/javascript" }));
  await page.route(EXCEL_CDN, (r) => r.fulfill({ body: EXCEL_FALSO, contentType: "text/javascript" }));
  const parametros = [colaborador ? "empleado" : "", extra].filter(Boolean).join("&");
  await page.goto(`/index.html${parametros ? "?" + parametros : ""}#/${ruta}`);
  await expect(page.locator("h1")).toBeVisible();
  return errores;
}
const aviso = (page) => page.locator("#aviso");

test.describe("Hoy", () => {
  test("carga sin errores y muestra las citas del día", async ({ page }) => {
    const errores = await abrir(page, "hoy");
    await expect(page.locator("#h-citas")).toContainText("Luna");
    expect(errores).toEqual([]);
  });

  test("en celular no hay desplazamiento horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrir(page, "hoy");
    await expect(page.locator("#h-citas")).toContainText("Luna");
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(1);
  });
});

test.describe("Roles", () => {
  test("el colaborador no ve Reportes ni Usuarios", async ({ page }) => {
    await abrir(page, "hoy", { colaborador: true });
    const menu = page.locator("#menu-secciones");
    await expect(menu).not.toContainText("Reportes");
    await expect(menu).not.toContainText("Usuarios");
  });

  test("si el colaborador escribe la dirección de Reportes, vuelve a Hoy", async ({ page }) => {
    await abrir(page, "reportes", { colaborador: true });
    await expect(page).toHaveURL(/#\/hoy/);
  });

  test("el colaborador ve los precios pero no los puede cambiar", async ({ page }) => {
    await abrir(page, "catalogos", { colaborador: true });
    await expect(page.locator("#cat-contenido")).toContainText("Solo el administrador puede cambiar los precios");
    await expect(page.locator("#cat-contenido input")).toHaveCount(0);
  });

  test("el colaborador ve servicios y recordatorios en modo lectura y no puede cambiar el logo", async ({ page }) => {
    await abrir(page, "catalogos", { colaborador: true });
    await page.getByRole("button", { name: "Servicios y recordatorios" }).click();
    await expect(page.locator("#cat-contenido")).toContainText("Solo el administrador puede cambiar los servicios");
    await expect(page.locator("#cat-contenido input")).toHaveCount(0);
    await page.getByRole("button", { name: "Logo del negocio" }).click();
    await expect(page.locator("#form-logo")).toBeHidden();
  });

  test("el colaborador sí puede editar guías", async ({ page }) => {
    await abrir(page, "catalogos", { colaborador: true });
    await page.getByRole("button", { name: "Guías" }).click();
    await expect(page.locator("#tabla-guias input").first()).toBeEditable();
  });
});

test.describe("Catálogos (administrador)", () => {
  test("cambiar un precio muestra Guardado", async ({ page }) => {
    await abrir(page, "catalogos");
    const precio = page.locator('#tabla-razas tr[data-id="1"] input[data-campo="precio_bano"]');
    await precio.fill("32000");
    await precio.blur();
    await expect(aviso(page)).toContainText("Guardado.");
    // El precio se guarda en la sede actual (precios por sede)
    expect(await page.evaluate(() => window.__T.precios_sede.find((p) => p.sede_id === 1 && p.raza_id === 1).precio_bano)).toBe(32000);
  });

  test("quitar una guía usa la ventana propia de confirmación", async ({ page }) => {
    await abrir(page, "catalogos");
    await page.getByRole("button", { name: "Guías" }).click();
    await page.locator("#tabla-guias [data-quitar]").first().click();
    const ventana = page.locator("#dialogo-confirmar");
    await expect(ventana).toBeVisible();
    await ventana.getByRole("button", { name: "Volver" }).click();
    await expect(page.locator("#tabla-guias tr")).toHaveCount(2);
    await page.locator("#tabla-guias [data-quitar]").first().click();
    await ventana.getByRole("button", { name: "Sí, quitar" }).click();
    await expect(aviso(page)).toContainText("Eliminado.");
    await expect(page.locator("#tabla-guias tr")).toHaveCount(1);
  });
});

test.describe("Clientes", () => {
  test("muestra todas las mascotas aunque sean más de 1.000", async ({ page }) => {
    await abrir(page, "clientes", { extra: "muchas" });
    await expect(page.locator("#c-lista")).toContainText("1203");
  });

  test("registrar una visita anterior la guarda con su fecha real", async ({ page }) => {
    await abrir(page, "clientes");
    await page.locator("#c-lista button.enlace", { hasText: "Rocky" }).click();
    await page.getByRole("button", { name: "Registrar visita anterior" }).click();
    await page.evaluate(() => elegirFecha(document.querySelector("#va-dia"), "2026-03-15"));
    await page.selectOption("#va-servicio", { label: "Baño" });
    await page.fill("#va-precio", "30000");
    await page.getByRole("button", { name: "Guardar visita" }).click();
    await expect(aviso(page)).toContainText("15/03/2026");
    await expect(page.locator("#f-historial")).toContainText("15/03/2026");
  });

  test("una visita anterior no puede tener fecha futura", async ({ page }) => {
    await abrir(page, "clientes");
    await page.locator("#c-lista button.enlace", { hasText: "Rocky" }).click();
    await page.getByRole("button", { name: "Registrar visita anterior" }).click();
    await page.evaluate(() => elegirFecha(document.querySelector("#va-dia"), sumarDias(hoyISO(), 3)));
    await page.getByRole("button", { name: "Guardar visita" }).click();
    await expect(page.locator("#va-error")).toContainText("no puede ser futura");
  });
});

test.describe("Calendario", () => {
  test("se maneja con el teclado", async ({ page }) => {
    await abrir(page, "agendar");
    const dia = await page.evaluate(() => document.querySelector("#a-dia").value || hoyISO());
    await page.locator("#a-dia + button.campo-fecha").click();
    await expect(page.locator(".calendario")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    const esperado = await page.evaluate((d) => sumarDias(d, 8), dia);
    await expect(page.locator("#a-dia")).toHaveValue(esperado);
  });
});

test.describe("Videos (oculto)", () => {
  test("Videos no aparece en el menú ni en la entrada, y su dirección lleva a Hoy", async ({ page }) => {
    await abrir(page, "hoy");
    await expect(page.locator("#menu-secciones")).not.toContainText("Videos");
    await page.goto("/index.html#/videos");
    await expect(page.locator("h1")).toHaveText("Hoy");
  });

  test("la entrada ya no tiene el enlace a videos", async ({ page }) => {
    await abrir(page, "hoy", { extra: "sinsesion" });
    await expect(page.getByText("Ver videos de productos")).toHaveCount(0);
  });
});

test.describe("Reportes", () => {
  test("descarga el respaldo completo con una hoja por tabla", async ({ page }) => {
    await abrir(page, "reportes");
    await page.getByRole("button", { name: /respaldo completo/ }).click();
    await expect(aviso(page)).toContainText("Respaldo descargado");
    const excel = await page.evaluate(() => window.__excel);
    expect(excel.nombre).toMatch(/^Respaldo_PetGarden_\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(excel.hojas[0]).toBe("Contenido");
    expect(excel.hojas).toEqual(expect.arrayContaining(["clientes", "citas", "servicios", "razas"]));
  });
});

test.describe("Multinegocio", () => {
  test("sin sesión, la entrada muestra el negocio de la dirección", async ({ page }) => {
    await abrir(page, "hoy", { extra: "sinsesion&negocio=vet-norte" });
    await expect(page.locator(".acceso-marca h1")).toHaveText("Vet Norte");
    await expect(page).toHaveTitle("Vet Norte · DALU Vital");
  });

  test("con sesión, Usuarios solo lista personas de mi negocio", async ({ page }) => {
    await abrir(page, "usuarios");
    await expect(page.locator("#u-lista")).toContainText("Andrés");
    await expect(page.locator("#u-lista")).not.toContainText("Laura");
  });

  test("DALU tampoco ve en Usuarios a personas de otros negocios", async ({ page }) => {
    await abrir(page, "usuarios", { extra: "dalu" });
    await expect(page.locator("#u-lista")).toContainText("Andrés");
    await expect(page.locator("#u-lista")).not.toContainText("Laura");
  });

  test("el administrador invita por correo a su negocio", async ({ page }) => {
    await abrir(page, "usuarios");
    await page.fill("#i-correo", "Nueva@Correo.co");
    await page.selectOption("#i-rol", "administrador");
    await page.getByRole("button", { name: "Invitar", exact: true }).click();
    await expect(page.locator("#dialogo h2")).toContainText("Invitación lista");
    const llamada = await page.evaluate(() => window.__log.find((x) => x[0] === "rpc" && x[1] === "invitar_usuario"));
    expect(llamada[2]).toEqual({ p_correo: "nueva@correo.co", p_rol: "administrador" });
    await expect(page.locator("#u-invitaciones")).toContainText("nueva@correo.co");
  });

  test("crear cuenta sin invitación muestra un mensaje claro", async ({ page }) => {
    await abrir(page, "hoy", { extra: "sinsesion" });
    await page.getByRole("button", { name: /Crea tu cuenta/ }).click();
    await page.fill("#cc-nombre", "Pedro");
    await page.fill("#cc-correo", "pedro@x.co");
    await page.fill("#cc-clave", "secreta123");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.locator("#cc-error")).toContainText("no tiene invitación");
  });

  test("el menú Negocios solo aparece para DALU", async ({ page }) => {
    await abrir(page, "hoy");
    await expect(page.locator("#menu-secciones")).not.toContainText("Negocios");
    await page.goto("/index.html#/negocios");
    await expect(page).toHaveURL(/#\/hoy/);
  });

  test("DALU crea un negocio con su enlace y la invitación del administrador", async ({ page }) => {
    await abrir(page, "negocios", { extra: "dalu" });
    await expect(page.locator("#n-lista")).toContainText("Vet Norte");
    await page.fill("#nn-nombre", "Veterinaria San Roque");
    await expect(page.locator("#nn-slug")).toHaveValue("veterinaria-san-roque");
    await page.fill("#nn-correo", "admin@sanroque.co");
    await page.getByRole("button", { name: "Crear negocio" }).click();
    await expect(page.locator("#dialogo")).toContainText("/veterinaria-san-roque");
    await expect(page.locator("#dialogo a", { hasText: "WhatsApp" })).toHaveAttribute("href", /wa\.me.*admin%40sanroque\.co/);
    const llamada = await page.evaluate(() => window.__log.find((x) => x[0] === "rpc" && x[1] === "crear_negocio"));
    expect(llamada[2]).toMatchObject({ p_nombre: "Veterinaria San Roque", p_slug: "veterinaria-san-roque", p_correo_admin: "admin@sanroque.co", p_plan: "basico" });
  });

  test("un usuario sin negocio ve el aviso y no el panel", async ({ page }) => {
    await abrir(page, "hoy", { extra: "sinnegocio" });
    await expect(page.locator("h1")).toHaveText("Tu usuario aún no tiene negocio");
    await expect(page.locator("#menu-secciones")).toHaveCount(0);
  });

  test("el logo se sube a la carpeta del negocio", async ({ page }) => {
    await abrir(page, "catalogos");
    await page.getByRole("button", { name: "Logo del negocio" }).click();
    await page.setInputFiles("#l-archivo", { name: "logo.png", mimeType: "image/png", buffer: Buffer.from("png") });
    await page.getByRole("button", { name: "Subir logo" }).click();
    await expect(aviso(page)).toContainText("Logo actualizado");
    const subida = await page.evaluate(() => window.__log.find((x) => x[0] === "upload"));
    expect(subida[2]).toMatch(/^1\/logo-\d+\.png$/);
  });
});

test.describe("Suscripción y pagos", () => {
  test("el administrador ve solo los pagos de su negocio", async ({ page }) => {
    await abrir(page, "suscripcion");
    await expect(page.locator("#s-pagos")).toContainText("Octubre 2026");
    await expect(page.locator("#s-pagos")).not.toContainText("Vet Norte");
    await expect(page.locator("#s-resumen")).toContainText("05/10/2026");
    await expect(page.locator("#s-resumen")).toContainText("2 pagos");
  });

  test("DALU tampoco ve en Suscripción los pagos de otros negocios", async ({ page }) => {
    await abrir(page, "suscripcion", { extra: "dalu" });
    await expect(page.locator("#s-pagos")).not.toContainText("Vet Norte");
  });

  test("el colaborador no ve Suscripción", async ({ page }) => {
    await abrir(page, "hoy", { colaborador: true });
    await expect(page.locator("#menu-secciones")).not.toContainText("Suscripción");
    await page.goto("/index.html?empleado#/suscripcion");
    await expect(page).toHaveURL(/#\/hoy/);
  });

  test("DALU registra un pago para un negocio", async ({ page }) => {
    await abrir(page, "negocios", { extra: "dalu" });
    await expect(page.locator("#np-lista")).toContainText("Pago de Vet Norte");
    await page.selectOption("#np-negocio", { label: "Vet Norte" });
    await page.evaluate(() => fijarFecha(document.querySelector("#np-fecha"), "2026-11-05"));
    await page.fill("#np-valor", "95000");
    await page.fill("#np-nota", "Noviembre 2026");
    await page.getByRole("button", { name: "Registrar pago" }).click();
    await expect(aviso(page)).toContainText("registrado para Vet Norte");
    const pago = await page.evaluate(() => window.__T.pagos.find((p) => p.nota === "Noviembre 2026"));
    expect(pago).toMatchObject({ negocio_id: 2, fecha: "2026-11-05", valor: 95000 });
  });
});

test.describe("Versión nueva", () => {
  test("avisa y ofrece recargar cuando se publica una versión nueva", async ({ page }) => {
    await abrir(page, "hoy");
    expect(await page.evaluate(() => VERSION_CARGADA)).toMatch(/^\d+$/);
    // Misma versión: no avisa
    await page.evaluate(() => revisarVersionNueva());
    await expect(page.locator("#aviso")).not.toContainText("versión nueva");
    // Se publica otra versión
    await page.route(/buscar-version=/, (r) => r.fulfill({ body: '<script src="app.js?v=2099010101"></script>', contentType: "text/html" }));
    await page.evaluate(() => revisarVersionNueva());
    await expect(page.locator("#aviso")).toContainText("Hay una versión nueva");
    await expect(page.locator("#aviso button")).toHaveText("Recargar");
  });
});

test.describe("Ronda 2: enlaces, invitaciones, roles y reportes", () => {
  test("el enlace corto /vet-norte llega a ese negocio (vía 404.html)", async ({ page }) => {
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js",
      (r) => r.fulfill({ path: require("path").join(__dirname, "supabase-falso.js"), contentType: "text/javascript" }));
    // GitHub muestra 404.html en /vet-norte, que vuelve a la página principal con ese negocio.
    // (En las pruebas hay una sesión de Pet Garden abierta, por eso aparece el aviso de otro negocio.)
    await page.goto("/vet-norte#/hoy");
    await expect(page.locator("#dialogo")).toContainText("Este enlace es de Vet Norte");
  });

  test("?negocio= también funciona y se cambia por la dirección corta", async ({ page }) => {
    await abrir(page, "hoy", { extra: "sinsesion&negocio=vet-norte" });
    await expect(page.locator(".acceso-marca h1")).toHaveText("Vet Norte");
    expect(new URL(page.url()).pathname).toBe("/vet-norte");
  });

  test("con sesión de Pet Garden, el enlace de otro negocio avisa y no muestra sus datos", async ({ page }) => {
    await abrir(page, "hoy", { extra: "negocio=vet-norte" });
    await expect(page.locator("#dialogo")).toContainText("Este enlace es de Vet Norte");
    await expect(page.locator("#dialogo")).toContainText("solo puedes ver Pet Garden");
    await page.getByRole("button", { name: "Seguir en Pet Garden" }).click();
    await expect(page.locator(".marca-lateral").first()).toContainText("Pet Garden");
    expect(new URL(page.url()).pathname).toBe("/petgarden");
  });

  test("Usuarios: los roles se ven con un botón (sin tabla fija)", async ({ page }) => {
    await abrir(page, "usuarios");
    await expect(page.locator("#pantalla .tabla-permisos")).toHaveCount(0);
    await page.getByRole("button", { name: "Ver qué puede hacer cada rol" }).click();
    await expect(page.locator("#dialogo .tabla-permisos")).toContainText("Reportes y Excel");
  });

  test("invitar abre el mensaje para enviar y se puede reenviar", async ({ page }) => {
    await abrir(page, "usuarios");
    await page.fill("#i-correo", "nueva@correo.co");
    await page.getByRole("button", { name: "Invitar", exact: true }).click();
    await expect(page.locator("#dialogo")).toContainText("nueva@correo.co");
    await expect(page.locator("#dialogo .mensaje-invitacion")).toContainText("/petgarden");
    await expect(page.locator("#dialogo a", { hasText: "Enviar por correo" })).toHaveAttribute("href", /^mailto:nueva%40correo\.co/);
    await page.getByRole("button", { name: "Listo" }).click();
    await page.locator("[data-reenviar='nueva@correo.co']").click();
    await expect(page.locator("#dialogo h2")).toHaveText("Reenviar la invitación");
  });

  test("Reportes: las tablas largas empiezan cerradas y se abren con encabezado fijo", async ({ page }) => {
    await abrir(page, "reportes");
    const duenos = page.locator('details[data-tabla="rep-clientes"]');
    await expect(duenos).toBeVisible();
    await expect(duenos).not.toHaveAttribute("open", "");
    await duenos.locator("summary").click();
    await expect(duenos.locator("table.interactiva")).toBeVisible();
    const fijo = await duenos.locator("thead").evaluate((t) => getComputedStyle(t).position);
    expect(fijo).toBe("sticky");
  });
});

test.describe("Sedes y planes", () => {
  test("con una sola sede no hay selector y la cita se agenda en esa sede", async ({ page }) => {
    await abrir(page, "agendar");
    await expect(page.locator("#sede-actual")).toHaveCount(0);
    await expect(page.locator(".sede-actual")).toContainText("Sede principal");
    await page.fill("#a-mascota", "Toby");
    await page.fill("#a-telefono", "3209998877");
    await page.fill("#a-dueno", "Marta");
    await page.getByRole("button", { name: "Agendar cita" }).click();
    const llamada = await page.evaluate(() => window.__log.find((x) => x[0] === "rpc" && x[1] === "registrar_cita"));
    expect(llamada[2].p_sede_id).toBe(1);
  });

  test("con dos sedes se elige la sede arriba y la agenda cambia", async ({ page }) => {
    await abrir(page, "hoy", { extra: "dossedes" });
    await expect(page.locator("#h-citas")).toContainText("Luna");
    await page.selectOption("#sede-actual", { label: "Sede Norte" });
    await expect(aviso(page)).toContainText("Estás en Sede Norte");
    await expect(page.locator("#h-citas")).toContainText("No tienes citas para hoy");
    await page.goto("/index.html?dossedes#/agendar");
    await expect(page.locator("#sede-actual")).toHaveValue("2"); // se recuerda la sede elegida
    await expect(page.locator("h1")).toContainText("Sede Norte");
  });

  test("el colaborador solo ve sus sedes (sin selector si tiene una)", async ({ page }) => {
    await abrir(page, "hoy", { colaborador: true, extra: "dossedes" });
    await expect(page.locator("#sede-actual")).toHaveCount(0);
    await expect(page.locator(".sede-actual")).toContainText("Sede principal");
    await expect(page.locator("#menu-secciones")).not.toContainText("Sedes");
  });

  test("Catálogos: cada sede tiene sus propios precios", async ({ page }) => {
    await abrir(page, "catalogos", { extra: "dossedes" });
    await page.selectOption("#cat-sede", { label: "Sede Norte" });
    const precio = page.locator('#tabla-razas tr[data-id="1"] input[data-campo="precio_bano"]');
    await expect(precio).toHaveValue("30000");
    await precio.fill("45000");
    await precio.blur();
    await expect(aviso(page)).toContainText("Guardado.");
    const precios = await page.evaluate(() => window.__T.precios_sede.filter((p) => p.raza_id === 1).map((p) => [p.sede_id, p.precio_bano]));
    expect(precios).toEqual([[1, 30000], [2, 45000]]);
  });

  test("Sedes: el administrador agrega una sede dentro de su plan", async ({ page }) => {
    await abrir(page, "sedes");
    await expect(page.locator("#sd-plan")).toContainText("Premium");
    await page.fill("#sd-nombre", "Sede Sur");
    await page.getByRole("button", { name: "Agregar sede" }).click();
    await expect(aviso(page)).toContainText("Sede Sur quedó creada");
    await expect(page.locator('#sd-lista input[value="Sede Sur"]')).toHaveCount(1);
    await expect(page.locator("#sd-lista")).not.toContainText("Pausada");
  });

  test("Sedes: el plan Básico no deja agregar otra sede", async ({ page }) => {
    await abrir(page, "sedes", { extra: "basico" });
    await expect(page.locator("#sd-plan")).toContainText("permite 1 sede");
    await expect(page.getByRole("button", { name: "Agregar sede" })).toBeDisabled();
    await expect(page.locator("#sd-lleno")).toBeVisible();
  });

  test("Usuarios: se invita eligiendo sedes y se ve el uso del plan", async ({ page }) => {
    await abrir(page, "usuarios", { extra: "dossedes" });
    await expect(page.locator("#u-uso")).toContainText("2 de 20");
    await page.fill("#i-correo", "norte@correo.co");
    await page.locator('input[name="i-sede"][value="1"]').uncheck();
    await page.locator('input[name="i-sede"][value="2"]').check();
    await page.getByRole("button", { name: "Invitar", exact: true }).click();
    await expect(page.locator("#dialogo h2")).toContainText("Invitación lista");
    const llamada = await page.evaluate(() => window.__log.find((x) => x[0] === "rpc" && x[1] === "invitar_usuario"));
    expect(llamada[2]).toMatchObject({ p_correo: "norte@correo.co", p_rol: "empleado", p_sedes: [2] });
  });

  test("Usuarios: el plan Básico se llena en 3 usuarios", async ({ page }) => {
    await abrir(page, "usuarios", { extra: "basico" });
    await page.fill("#i-correo", "tercera@correo.co");
    await page.getByRole("button", { name: "Invitar", exact: true }).click();
    await page.getByRole("button", { name: "Listo" }).click();
    await expect(page.locator("#u-uso")).toContainText("3 de 3");
    await expect(page.getByRole("button", { name: "Invitar", exact: true })).toBeDisabled();
  });

  test("Usuarios: cambiar las sedes de un colaborador", async ({ page }) => {
    await abrir(page, "usuarios", { extra: "dossedes" });
    await page.locator('[data-sedes="u2"]').click();
    await page.locator('input[name="eu-sede"][value="2"]').check();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(aviso(page)).toContainText("Sedes de Andrés actualizadas");
    const sedes = await page.evaluate(() => window.__T.usuarios_sedes.filter((x) => x.usuario_id === "u2").map((x) => x.sede_id).sort());
    expect(sedes).toEqual([1, 2]);
  });

  test("un plan sin recordatorios oculta «A quién buscar»", async ({ page }) => {
    await abrir(page, "hoy", { extra: "sinrecordatorios" });
    await expect(page.locator("#h-citas")).toContainText("Luna");
    await expect(page.getByText("A quién buscar hoy")).toHaveCount(0);
  });

  test("un plan sin reportes oculta Reportes", async ({ page }) => {
    await abrir(page, "hoy", { extra: "sinreportes" });
    await expect(page.locator("#menu-secciones")).not.toContainText("Reportes");
    await page.goto("/index.html?sinreportes#/reportes");
    await expect(page).toHaveURL(/#\/hoy/);
    await expect(aviso(page)).toContainText("no está incluida en tu plan");
  });

  test("empresa pausada: aviso y sin panel", async ({ page }) => {
    await abrir(page, "hoy", { extra: "pausado" });
    await expect(page.locator("h1")).toHaveText("Tu empresa está pausada");
    await expect(page.locator("#menu-secciones")).toHaveCount(0);
  });

  test("Suscripción muestra el plan y sus límites", async ({ page }) => {
    await abrir(page, "suscripcion");
    await expect(page.locator("#s-plan")).toContainText("Plan Premium");
    await expect(page.locator("#s-plan")).toContainText("1 de 5");
  });

  test("DALU cambia el plan de una empresa y edita los límites de un plan", async ({ page }) => {
    await abrir(page, "negocios", { extra: "dalu" });
    await expect(page.locator("#n-lista")).toContainText("1/5 sedes");
    await page.selectOption('[data-plan="2"]', "profesional");
    await page.getByRole("button", { name: "Sí, cambiar" }).click();
    await expect(aviso(page)).toContainText("Vet Norte quedó en el plan Profesional");
    expect(await page.evaluate(() => window.__T.negocios.find((n) => n.id === 2).plan_id)).toBe("profesional");
    const usuariosBasico = page.locator('#np-planes input[data-plan-id="basico"][data-campo="max_usuarios"]');
    await usuariosBasico.fill("4");
    await usuariosBasico.blur();
    await expect(aviso(page)).toContainText("Plan actualizado");
    expect(await page.evaluate(() => window.__T.planes.find((p) => p.id === "basico").max_usuarios)).toBe(4);
  });
});
