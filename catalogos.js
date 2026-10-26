"use strict";

/* =====================================================================
   CATÁLOGOS: razas con precios (por sede), guías, servicios y logo del negocio
   ===================================================================== */

let pestanaCat = "razas";
const PESTANAS_CAT = {
  razas: "Razas y precios",
  guias: "Guías",
  servicios: "Servicios y recordatorios",
  negocio: "Logo del negocio",
};
const SERVICIOS_FIJOS = Object.keys(COLUMNA_PRECIO); // Baño, Corte, Corte y baño

// Guarda un solo campo editado en la tabla.
async function guardarCampo(tabla, id, entrada) {
  const campo = entrada.dataset.campo;
  let valor = entrada.value.trim();
  if (entrada.type === "number") {
    valor = valor === "" ? null : Number(valor);
    if (campo === "frecuencia_dias" && !(valor > 0)) {
      aviso("Los días deben ser un número mayor que 0.", true);
      return cargarCatalogos();
    }
  } else if (entrada.dataset.opcional !== undefined) {
    valor = valor === "" ? null : valor;
  } else if (valor === "") {
    aviso("Este campo no puede quedar vacío.", true);
    return cargarCatalogos();
  }
  if (campo === "grupo_id") valor = Number(valor);
  try {
    // Se pide la fila guardada: si la base no dejó cambiarla (permisos), no vuelve nada.
    const filas = await q(db.from(tabla).update({ [campo]: valor }).eq("id", id).select("id"));
    if (!filas.length) throw new Error("permission denied");
    aviso("Guardado.");
  } catch (error) {
    aviso(mensajeError(error), true);
    await cargarCatalogos();
  }
}

// Conecta una tabla para guardar automáticamente cada cambio.
function conectarEdicion(contenedor, tabla) {
  contenedor.addEventListener("change", (evento) => {
    const entrada = evento.target;
    const fila = entrada.closest("tr[data-id]");
    if (fila && entrada.dataset.campo) guardarCampo(tabla, Number(fila.dataset.id), entrada);
  });
}

async function quitarFila(tabla, id, pregunta) {
  if (!(await confirmar({ titulo: "¿Quitar?", texto: pregunta, boton: "Sí, quitar", peligro: true }))) return;
  try {
    const filas = await q(db.from(tabla).delete().eq("id", id).select("id"));
    if (!filas.length) throw new Error("permission denied");
    aviso("Eliminado.");
    cargarCatalogos();
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function agregar(tabla, datos, formulario) {
  const caja = $(".error", formulario);
  caja.textContent = "";
  try {
    await q(db.from(tabla).insert(datos));
    aviso("Agregado.");
    cargarCatalogos();
  } catch (error) {
    caja.textContent = mensajeError(error);
  }
}

const numeroONulo = (id) => ($(id).value === "" ? null : Number($(id).value));

/* ---------- Razas y precios ---------- */
// La lista de razas es de toda la empresa; los PRECIOS son de cada sede (tabla precios_sede).
const CAMPOS_PRECIO = ["precio_bano", "precio_corte", "precio_corte_bano", "precio_unas"];
let sedePrecios = null; // sede cuyos precios se están viendo en Catálogos

// Guarda un precio de una raza en una sede (crea la fila si no existía).
async function guardarPrecioSede(razaId, entrada) {
  const valor = entrada.value.trim() === "" ? null : Number(entrada.value);
  try {
    const filas = await q(db.from("precios_sede")
      .upsert({ sede_id: sedePrecios, raza_id: razaId, [entrada.dataset.campo]: valor }, { onConflict: "sede_id,raza_id" })
      .select("raza_id"));
    if (!filas.length) throw new Error("permission denied");
    aviso("Guardado.");
  } catch (error) {
    aviso(mensajeError(error), true);
    await cargarCatalogos();
  }
}

async function pestanaRazas(caja) {
  const porSede = estado.conSedes && estado.sedes.length;
  if (porSede) {
    const opciones = esAdmin() ? estado.sedes.filter((x) => x.activo) : estado.sedesMias;
    if (!opciones.some((x) => x.id === sedePrecios)) sedePrecios = (estado.sede || opciones[0] || {}).id ?? null;
  }
  const razas = await q(porSede
    ? db.from("razas_sede").select("*").eq("sede_id", sedePrecios).order("especie").order("nombre")
    : db.from("razas").select("*").order("especie").order("nombre"));
  const selector = porSede && (esAdmin() ? estado.sedes.filter((x) => x.activo) : estado.sedesMias).length > 1
    ? `<div class="fila-sede"><label for="cat-sede">Precios de la sede</label>
        <select id="cat-sede">${(esAdmin() ? estado.sedes.filter((x) => x.activo) : estado.sedesMias).map((x) =>
          `<option value="${x.id}"${x.id === sedePrecios ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select></div>`
    : porSede ? `<p class="suave">Precios de <strong>${esc(nombreSede(sedePrecios))}</strong>.</p>` : "";
  const conectarSelector = () => {
    const sel = $("#cat-sede");
    if (sel) sel.addEventListener("change", () => { sedePrecios = Number(sel.value); cargarCatalogos(); });
  };
  // Colaborador: solo puede ver la lista de precios (no agregar, cambiar ni quitar razas).
  if (!esAdmin()) {
    caja.innerHTML = `<p class="aviso-fijo">Solo el administrador puede cambiar los precios y las razas.</p>${selector}
      <div class="tabla-scroll"><table><thead><tr><th>Raza</th><th>Especie</th><th class="num">Baño</th><th class="num">Corte</th><th class="num">Corte y baño</th><th class="num">Uñas</th></tr></thead>
      <tbody>${razas.map((r) => `<tr><td>${esc(r.nombre)}</td><td>${esc(r.especie)}</td>
        ${CAMPOS_PRECIO.map((c) => `<td class="num">${dinero(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    conectarSelector();
    return;
  }
  caja.innerHTML = `
    <p class="suave">Escribe aquí tus precios. Al cambiar una celda se guarda sola.${porSede && estado.sedes.length > 1
      ? " <strong>Cada sede tiene sus propios precios</strong>; el nombre de la raza es el mismo para todas." : ""}
    El recargo del baño medicado se elige al agendar o al terminar la cita.</p>
    ${selector}
    <form id="nueva-raza" class="fila-nueva">
      <div><label for="r-nombre">Raza</label><input id="r-nombre" required></div>
      <div><label for="r-especie">Especie</label><select id="r-especie"><option value="perro">Perro</option><option value="gato">Gato</option></select></div>
      <div><label for="r-bano">Baño</label><input id="r-bano" type="number" min="0" step="any"></div>
      <div><label for="r-corte">Corte</label><input id="r-corte" type="number" min="0" step="any"></div>
      <div><label for="r-cb">Corte y baño</label><input id="r-cb" type="number" min="0" step="any"></div>
      <div><label for="r-unas">Uñas</label><input id="r-unas" type="number" min="0" step="any"></div>
      <div><button class="btn" type="submit">Agregar raza</button></div>
      <p class="error" role="alert"></p>
    </form>
    <div class="tabla-scroll"><table><thead><tr><th>Raza</th><th>Especie</th><th>Baño</th><th>Corte</th><th>Corte y baño</th><th>Uñas</th><th></th></tr></thead>
    <tbody id="tabla-razas">${razas.map((r) => `<tr data-id="${r.id}">
      <td><input data-campo="nombre" value="${esc(r.nombre)}" aria-label="Nombre de la raza"></td>
      <td>${esc(r.especie)}</td>
      ${CAMPOS_PRECIO.map((c) =>
        `<td><input data-campo="${c}" data-precio type="number" min="0" step="any" value="${esc(r[c])}" aria-label="${c}"></td>`).join("")}
      <td><button class="btn alt" data-quitar="${r.id}">Quitar</button></td></tr>`).join("")}</tbody></table></div>`;

  conectarSelector();
  // El nombre se guarda en la raza (toda la empresa); los precios, en la sede elegida.
  $("#tabla-razas").addEventListener("change", (evento) => {
    const entrada = evento.target;
    const fila = entrada.closest("tr[data-id]");
    if (!fila || !entrada.dataset.campo) return;
    if (porSede && entrada.dataset.precio !== undefined) guardarPrecioSede(Number(fila.dataset.id), entrada);
    else guardarCampo("razas", Number(fila.dataset.id), entrada);
  });
  $$("[data-quitar]", caja).forEach((b) => b.addEventListener("click", () =>
    quitarFila("razas", Number(b.dataset.quitar), "¿Quitar esta raza de TODAS las sedes? Las mascotas que la tengan quedarán sin raza.")));
  $("#nueva-raza").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const precios = {
      precio_bano: numeroONulo("#r-bano"),
      precio_corte: numeroONulo("#r-corte"),
      precio_corte_bano: numeroONulo("#r-cb"),
      precio_unas: numeroONulo("#r-unas"),
    };
    const datos = { nombre: $("#r-nombre").value.trim(), especie: $("#r-especie").value };
    if (!porSede) return agregar("razas", { ...datos, ...precios }, evento.target);
    const caja = $(".error", evento.target);
    caja.textContent = "";
    try {
      const [raza] = await q(db.from("razas").insert(datos).select("id"));
      await q(db.from("precios_sede").upsert({ sede_id: sedePrecios, raza_id: raza.id, ...precios }, { onConflict: "sede_id,raza_id" }));
      aviso("Agregado.");
      cargarCatalogos();
    } catch (error) {
      caja.textContent = mensajeError(error);
    }
  });
}

/* ---------- Guías ---------- */
async function pestanaGuias(caja) {
  const guias = await q(db.from("guias").select("*").order("nombre"));
  caja.innerHTML = `
    <p class="suave">Estas son las opciones del desplegable "Guía usada" al terminar una cita.</p>
    <form id="nueva-guia" class="fila-nueva">
      <div><label for="g-nombre">Número de guía</label><input id="g-nombre" required></div>
      <div><label for="g-desc">Descripción (opcional)</label><input id="g-desc"></div>
      <div><button class="btn" type="submit">Agregar guía</button></div>
      <p class="error" role="alert"></p>
    </form>
    <div class="tabla-scroll"><table><thead><tr><th>Guía</th><th>Descripción</th><th></th></tr></thead>
    <tbody id="tabla-guias">${guias.map((g) => `<tr data-id="${g.id}">
      <td><input data-campo="nombre" value="${esc(g.nombre)}" aria-label="Número de guía"></td>
      <td><input data-campo="descripcion" data-opcional value="${esc(g.descripcion ?? "")}" aria-label="Descripción"></td>
      <td><button class="btn alt" data-quitar="${g.id}">Quitar</button></td></tr>`).join("")}</tbody></table></div>`;

  conectarEdicion($("#tabla-guias"), "guias");
  $$("[data-quitar]", caja).forEach((b) => b.addEventListener("click", () =>
    quitarFila("guias", Number(b.dataset.quitar), "¿Quitar esta guía? Los servicios que la usaron quedarán sin guía.")));
  $("#nueva-guia").addEventListener("submit", (evento) => {
    evento.preventDefault();
    agregar("guias", { nombre: $("#g-nombre").value.trim(), descripcion: $("#g-desc").value.trim() || null }, evento.target);
  });
}

/* ---------- Servicios y grupos de recordatorio ---------- */
async function pestanaServicios(caja) {
  const [grupos, tipos] = await Promise.all([
    q(db.from("grupos_recordatorio").select("*").order("id")),
    q(db.from("tipos_servicio").select("*").order("id")),
  ]);
  const opcionesGrupo = (actual) => grupos.map((g) =>
    `<option value="${g.id}"${g.id === actual ? " selected" : ""}>${esc(g.nombre)}</option>`).join("");
  // Colaborador: solo ve los servicios y cada cuántos días vuelven (cambiarlos afecta a todos).
  if (!esAdmin()) {
    const nombreGrupo = new Map(grupos.map((g) => [g.id, g.nombre]));
    caja.innerHTML = `<p class="aviso-fijo">Solo el administrador puede cambiar los servicios y los recordatorios.</p>
      <h3>Grupos de recordatorio</h3>
      <div class="tabla-scroll"><table><thead><tr><th>Grupo</th><th class="num">Días para volver</th></tr></thead>
      <tbody>${grupos.map((g) => `<tr><td>${esc(g.nombre)}</td><td class="num">${esc(g.frecuencia_dias)}</td></tr>`).join("")}</tbody></table></div>
      <h3>Servicios</h3>
      <div class="tabla-scroll"><table><thead><tr><th>Servicio</th><th>Grupo</th></tr></thead>
      <tbody>${tipos.map((t) => `<tr><td>${esc(t.nombre)}</td><td>${esc(nombreGrupo.get(t.grupo_id) ?? "—")}</td></tr>`).join("")}</tbody></table></div>`;
    return;
  }

  caja.innerHTML = `
    <p class="aviso-fijo">No cambies el nombre de <strong>${SERVICIOS_FIJOS.join(", ")}</strong>: el precio sugerido por raza depende de esos nombres.</p>
    <h3>Grupos de recordatorio</h3>
    <p class="suave">Los servicios de un mismo grupo cuentan igual para avisarte cuándo debe volver el cliente.</p>
    <form id="nuevo-grupo" class="fila-nueva">
      <div><label for="gr-nombre">Nombre del grupo</label><input id="gr-nombre" required></div>
      <div><label for="gr-dias">Cada cuántos días</label><input id="gr-dias" type="number" min="1" required></div>
      <div><button class="btn" type="submit">Agregar grupo</button></div>
      <p class="error" role="alert"></p>
    </form>
    <div class="tabla-scroll"><table><thead><tr><th>Grupo</th><th>Días para volver</th></tr></thead>
    <tbody id="tabla-grupos">${grupos.map((g) => `<tr data-id="${g.id}">
      <td><input data-campo="nombre" value="${esc(g.nombre)}" aria-label="Nombre del grupo"></td>
      <td><input data-campo="frecuencia_dias" type="number" min="1" value="${esc(g.frecuencia_dias)}" aria-label="Días"></td></tr>`).join("")}</tbody></table></div>

    <h3>Servicios</h3>
    <form id="nuevo-tipo" class="fila-nueva">
      <div><label for="t-nuevo">Nombre del servicio</label><input id="t-nuevo" required></div>
      <div><label for="t-grupo">Grupo</label><select id="t-grupo">${opcionesGrupo(null)}</select></div>
      <div><button class="btn" type="submit">Agregar servicio</button></div>
      <p class="error" role="alert"></p>
    </form>
    <div class="tabla-scroll"><table><thead><tr><th>Servicio</th><th>Grupo</th></tr></thead>
    <tbody id="tabla-tipos">${tipos.map((t) => `<tr data-id="${t.id}">
      <td><input data-campo="nombre" value="${esc(t.nombre)}" aria-label="Nombre del servicio"${SERVICIOS_FIJOS.includes(t.nombre) ? " disabled" : ""}></td>
      <td><select data-campo="grupo_id" aria-label="Grupo">${opcionesGrupo(t.grupo_id)}</select></td></tr>`).join("")}</tbody></table></div>`;

  conectarEdicion($("#tabla-grupos"), "grupos_recordatorio");
  conectarEdicion($("#tabla-tipos"), "tipos_servicio");
  $("#nuevo-grupo").addEventListener("submit", (evento) => {
    evento.preventDefault();
    agregar("grupos_recordatorio", { nombre: $("#gr-nombre").value.trim(), frecuencia_dias: Number($("#gr-dias").value) }, evento.target);
  });
  $("#nuevo-tipo").addEventListener("submit", (evento) => {
    evento.preventDefault();
    agregar("tipos_servicio", { nombre: $("#t-nuevo").value.trim(), grupo_id: Number($("#t-grupo").value) }, evento.target);
  });
}

/* ---------- Logo del negocio ---------- */
const TIPOS_LOGO = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

async function subirLogo(evento) {
  evento.preventDefault();
  const error = $("#l-error");
  error.textContent = "";
  const archivo = $("#l-archivo").files[0];
  if (!archivo) return;
  const extension = TIPOS_LOGO[archivo.type];
  if (!extension) { error.textContent = "Usa una imagen PNG, JPG, WEBP o SVG."; return; }
  if (archivo.size > 2 * 1024 * 1024) { error.textContent = "La imagen pesa más de 2 MB. Usa una más liviana."; return; }
  const boton = $("button[type=submit]", evento.target);
  boton.disabled = true;
  boton.textContent = "Subiendo…";
  try {
    // Cada negocio guarda su logo en su propia carpeta (logo/1/..., logo/2/...).
    const nombre = `logo-${Date.now()}.${extension}`;
    const { error: fallo } = await db.storage.from("logo")
      .upload(enCarpeta(nombre), archivo, { contentType: archivo.type, cacheControl: "31536000" });
    if (fallo) throw fallo;
    // Se borran los logos anteriores de ESTE negocio para no acumular archivos.
    const { data } = await db.storage.from("logo").list(carpetaNegocio(), { limit: 100 });
    const viejos = (data || []).map((f) => f.name).filter((n) => /^logo-/.test(n) && n !== nombre).map(enCarpeta);
    if (viejos.length) await db.storage.from("logo").remove(viejos);
    await cargarLogo();
    aviso("Logo actualizado.");
    pintar();
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
    boton.disabled = false;
    boton.textContent = "Subir logo";
  }
}

async function pestanaNegocio(caja) {
  caja.innerHTML = `
    <p class="suave">Sube el logo de ${esc(nombreNegocio())}. Se verá en la pantalla de entrada y en el menú.
    Funciona mejor una imagen cuadrada o redonda, con fondo transparente (PNG).</p>
    <div class="logo-vista">${estado.logoUrl
      ? `<img src="${esc(estado.logoUrl)}" alt="Logo actual">`
      : '<p class="suave">Todavía no has subido un logo.</p>'}</div>
    ${esAdmin() ? "" : '<p class="aviso-fijo">Solo el administrador puede cambiar el logo.</p>'}
    <form id="form-logo"${esAdmin() ? "" : " hidden"}>
      <label for="l-archivo">Imagen (PNG, JPG, WEBP o SVG; máximo 2 MB)</label>
      <input id="l-archivo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required>
      <p id="l-error" class="error" role="alert"></p>
      <button class="btn" type="submit">Subir logo</button>
    </form>
    ${estado.negocio && estado.negocio.slug ? `<h3>Enlace de ${esc(nombreNegocio())}</h3>
    <p class="suave">Compártelo con tu equipo: abre el sistema con tu nombre y tu logo.</p>
    <ul class="enlaces-negocio">
      <li>Entrada para tu equipo: <a href="${esc(enlacePublico(estado.negocio.slug))}" target="_blank" rel="noopener">${esc(enlacePublico(estado.negocio.slug))}</a></li>
    </ul>` : ""}`;
  if (esAdmin()) $("#form-logo").addEventListener("submit", subirLogo);
}

const CARGADORES_CAT = { razas: pestanaRazas, guias: pestanaGuias, servicios: pestanaServicios, negocio: pestanaNegocio };

async function cargarCatalogos() {
  const caja = $("#cat-contenido");
  if (!caja) return;
  try {
    await CARGADORES_CAT[pestanaCat](caja);
  } catch (error) {
    mostrarError(caja, error);
  }
}

PANTALLAS.catalogos = {
  html: () => `<h1>Catálogos</h1>
    <p class="suave">Tu lista de precios por raza, las guías de la máquina, los servicios y el logo.</p>
    <div class="tarjeta">
      <div class="filtros">${Object.entries(PESTANAS_CAT).map(([clave, texto]) =>
        `<button class="chip" data-pestana="${clave}" aria-pressed="${clave === pestanaCat}">${texto}</button>`).join("")}</div>
      <div id="cat-contenido"><p class="suave">Cargando…</p></div>
    </div>`,
  despues: async () => {
    $$("[data-pestana]").forEach((b) => b.addEventListener("click", () => {
      pestanaCat = b.dataset.pestana;
      montarPantalla("catalogos");
    }));
    await cargarCatalogos();
  },
};