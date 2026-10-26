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
    expect(await page.evaluate(() => window.__T.razas[0].precio_bano)).toBe(32000);
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

test.describe("Videos", () => {
  test("los videos nuevos solo se suben como archivo (sin campo de YouTube)", async ({ page }) => {
    await abrir(page, "videos");
    await expect(page.locator("#form-video")).toBeVisible();
    await expect(page.locator("#v-url")).toHaveCount(0);
  });

  test("el colaborador no tiene botón Borrar", async ({ page }) => {
    await abrir(page, "videos", { colaborador: true });
    await expect(page.locator("#form-video")).toBeVisible();
    await expect(page.locator("[data-borrar]")).toHaveCount(0);
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

  test("los videos públicos solo muestran los del negocio de la dirección", async ({ page }) => {
    await abrir(page, "videos", { extra: "sinsesion&negocio=petgarden" });
    await expect(page.locator("#v-publico")).not.toContainText("Cargando");
    const cargados = await page.evaluate(() => V.todos.map((v) => v.titulo));
    expect(cargados).toContain("Croquetas premium");
    expect(cargados).not.toContain("Solo de Vet Norte");
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
    await expect(aviso(page)).toContainText("Invitación lista");
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
    await expect(page.locator("#dialogo")).toContainText("?negocio=veterinaria-san-roque");
    const llamada = await page.evaluate(() => window.__log.find((x) => x[0] === "rpc" && x[1] === "crear_negocio"));
    expect(llamada[2]).toEqual({ p_nombre: "Veterinaria San Roque", p_slug: "veterinaria-san-roque", p_correo_admin: "admin@sanroque.co" });
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
