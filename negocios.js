"use strict";

/* =====================================================================
   NEGOCIOS (solo DALU): los clientes que usan DALU Vital.
   - Crear un negocio nuevo: nombre, dirección corta (para su enlace) y el correo
     de su administrador. La base le copia los servicios y recordatorios base
     y deja lista la invitación del administrador.
   - Invitar más personas a cualquier negocio, y activar o pausar negocios.
   - Registrar los pagos de la suscripción de cada negocio (solo informativo:
     el administrador de cada negocio los ve en su pantalla "Suscripción").
   DALU administra los negocios pero NO ve los datos de sus clientes.
   ===================================================================== */

// "Veterinaria San Roque" → "veterinaria-san-roque"
function slugDe(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

let NEG = [];

async function cargarNegocios() {
  const caja = $("#n-lista");
  if (!caja) return;
  try {
    NEG = await q(db.from("negocios").select("id,nombre,slug,activo,creado_en").order("id"));
    if (!$("#n-lista")) return;
    tablaInteractiva(caja, {
      id: "negocios",
      filas: NEG,
      vacio: "Todavía no hay negocios.",
      columnas: [
        { titulo: "Negocio", valor: (n) => n.nombre, filtro: "texto" },
        { titulo: "Enlace", valor: (n) => n.slug, filtro: "texto" },
        { titulo: "Estado", valor: (n) => (n.activo ? "Activo" : "Pausado"), filtro: "lista" },
        { titulo: "", valor: () => "", filtro: false },
      ],
      fila: (n) => `<tr>
        <td><strong>${esc(n.nombre)}</strong>${estado.negocio && n.id === estado.negocio.id ? ' <span class="etiqueta">el tuyo</span>' : ""}</td>
        <td><a href="${esc(enlacePublico(n.slug))}" target="_blank" rel="noopener">?negocio=${esc(n.slug)}</a></td>
        <td>${n.activo ? '<span class="etiqueta ok">Activo</span>' : '<span class="etiqueta gris">Pausado</span>'}</td>
        <td><button type="button" class="btn alt chico" data-activo="${n.id}">${n.activo ? "Pausar" : "Activar"}</button></td>
      </tr>`,
      alPintar: (tbody) => $$("[data-activo]", tbody).forEach((b) =>
        b.addEventListener("click", () => cambiarActivoNegocio(NEG.find((n) => n.id === Number(b.dataset.activo))))),
    });
    const opciones = NEG.map((n) => `<option value="${n.id}">${esc(n.nombre)}</option>`).join("");
    ["#ni-negocio", "#np-negocio"].forEach((id) => { const lista = $(id); if (lista) lista.innerHTML = opciones; });
  } catch (error) {
    mostrarError(caja, error);
  }
}

async function cambiarActivoNegocio(negocio) {
  if (!negocio) return;
  const pausar = negocio.activo;
  if (!(await confirmar({
    titulo: pausar ? `¿Pausar ${negocio.nombre}?` : `¿Activar ${negocio.nombre}?`,
    texto: pausar ? "Su página pública de videos deja de verse. Sus datos no se borran." : "Su página pública vuelve a verse.",
    boton: pausar ? "Sí, pausar" : "Sí, activar",
  }))) return;
  try {
    const filas = await q(db.from("negocios").update({ activo: !pausar }).eq("id", negocio.id).select("id"));
    if (!filas.length) throw new Error("permission denied");
    aviso(`${negocio.nombre} quedó ${pausar ? "pausado" : "activo"}.`);
    cargarNegocios();
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function crearNegocio(evento) {
  evento.preventDefault();
  const error = $("#nn-error");
  const boton = $("button[type=submit]", evento.target);
  error.textContent = "";
  const nombre = $("#nn-nombre").value.trim();
  const slug = slugDe($("#nn-slug").value || nombre);
  const correo = $("#nn-correo").value.trim().toLowerCase();
  if (!slug) { error.textContent = "Escribe la dirección corta (solo letras, números y guiones)."; return; }
  boton.disabled = true;
  boton.textContent = "Creando…";
  try {
    await q(db.rpc("crear_negocio", { p_nombre: nombre, p_slug: slug, p_correo_admin: correo }));
    evento.target.reset();
    abrirDialogo(`<div>
      <h2>¡${esc(nombre)} quedó creado!</h2>
      <p>Envíale esto a su administrador (${esc(correo)}):</p>
      <ol class="pasos">
        <li>Entra a <a href="${esc(enlacePublico(slug))}" target="_blank" rel="noopener">${esc(enlacePublico(slug))}</a></li>
        <li>Toca <strong>«¿Te invitaron? Crea tu cuenta»</strong> con el correo ${esc(correo)}.</li>
        <li>Confirma el correo que te llega, entra y sube tu logo en Catálogos → Negocio.</li>
      </ol>
      <div class="acciones"><button type="button" class="btn" id="nn-cerrar">Listo</button></div></div>`);
    $("#nn-cerrar").addEventListener("click", () => cerrarDialogo());
    cargarNegocios();
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
  } finally {
    boton.disabled = false;
    boton.textContent = "Crear negocio";
  }
}

async function invitarANegocio(evento) {
  evento.preventDefault();
  const error = $("#ni-error");
  const boton = $("button[type=submit]", evento.target);
  error.textContent = "";
  boton.disabled = true;
  try {
    const correo = $("#ni-correo").value.trim().toLowerCase();
    const negocio = NEG.find((n) => n.id === Number($("#ni-negocio").value));
    const resultado = await q(db.rpc("invitar_usuario", {
      p_correo: correo, p_rol: $("#ni-rol").value, p_negocio_id: negocio ? negocio.id : null,
    }));
    $("#ni-correo").value = "";
    aviso(resultado === "asignado"
      ? `${correo} ya tenía cuenta: quedó en ${negocio ? negocio.nombre : "el negocio"}.`
      : `Invitación lista para ${correo} en ${negocio ? negocio.nombre : "el negocio"}.`);
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
  } finally {
    boton.disabled = false;
  }
}

/* ---------- Pagos de la suscripción ---------- */
async function cargarPagosDalu() {
  const caja = $("#np-lista");
  if (!caja) return;
  try {
    const pagos = await q(db.from("pagos").select("id,negocio_id,fecha,valor,nota").order("fecha", { ascending: false }));
    if (!$("#np-lista")) return;
    const nombreDe = (id) => (NEG.find((n) => n.id === id) || {}).nombre || `Negocio ${id}`;
    tablaInteractiva(caja, {
      id: "pagos-dalu",
      filas: pagos,
      vacio: "Todavía no has registrado pagos.",
      columnas: [
        { titulo: "Fecha", valor: (p) => p.fecha, filtro: false },
        { titulo: "Negocio", valor: (p) => nombreDe(p.negocio_id), filtro: "lista" },
        { titulo: "Valor", valor: (p) => Number(p.valor), filtro: false },
        { titulo: "Nota", valor: (p) => p.nota ?? "", filtro: "texto" },
        { titulo: "", valor: () => "", filtro: false },
      ],
      fila: (p) => `<tr>
        <td>${esc(fechaCorta(p.fecha))}</td>
        <td>${esc(nombreDe(p.negocio_id))}</td>
        <td>${esc(dinero(p.valor))}</td>
        <td>${esc(p.nota || "—")}</td>
        <td><button type="button" class="btn alt chico" data-quitar-pago="${p.id}">Quitar</button></td>
      </tr>`,
      alPintar: (tbody) => $$("[data-quitar-pago]", tbody).forEach((b) => b.addEventListener("click", () =>
        quitarPago(pagos.find((p) => p.id === Number(b.dataset.quitarPago)), nombreDe))),
    });
  } catch (error) {
    mostrarError(caja, error);
  }
}

async function registrarPago(evento) {
  evento.preventDefault();
  const error = $("#np-error");
  const boton = $("button[type=submit]", evento.target);
  error.textContent = "";
  const valor = Number($("#np-valor").value);
  if (!(valor > 0)) { error.textContent = "Escribe un valor mayor que cero."; return; }
  boton.disabled = true;
  try {
    const negocio = NEG.find((n) => n.id === Number($("#np-negocio").value));
    await q(db.from("pagos").insert({
      negocio_id: negocio.id, fecha: $("#np-fecha").value, valor, nota: $("#np-nota").value.trim() || null,
    }));
    aviso(`Pago de ${dinero(valor)} registrado para ${negocio.nombre}.`);
    $("#np-valor").value = "";
    $("#np-nota").value = "";
    cargarPagosDalu();
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
  } finally {
    boton.disabled = false;
  }
}

async function quitarPago(pago, nombreDe) {
  if (!pago) return;
  if (!(await confirmar({
    titulo: "¿Quitar este pago?",
    texto: `${nombreDe(pago.negocio_id)} · ${fechaCorta(pago.fecha)} · ${dinero(pago.valor)}`,
    boton: "Sí, quitar", peligro: true,
  }))) return;
  try {
    await q(db.from("pagos").delete().eq("id", pago.id));
    aviso("Pago quitado.");
    cargarPagosDalu();
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

PANTALLAS.negocios = {
  html: () => `<h1>Negocios · DALU</h1>
    <p class="suave">Los clientes que usan ${esc(NOMBRE_PRODUCTO)}. Solo DALU ve esta pantalla y no ve los datos de sus clientes.</p>
    <div class="columnas derecha">
      <div class="tarjeta"><div id="n-lista"><p class="suave">Cargando…</p></div></div>
      <div>
        <div class="tarjeta">
          <h2>Crear un negocio</h2>
          <form id="form-negocio">
            <label for="nn-nombre">Nombre del negocio</label>
            <input id="nn-nombre" maxlength="60" required placeholder="Veterinaria San Roque">
            <label for="nn-slug">Dirección corta (para su enlace)</label>
            <input id="nn-slug" maxlength="40" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="veterinaria-san-roque"
              title="Solo minúsculas, números y guiones">
            <p class="suave" id="nn-vista"></p>
            <label for="nn-correo">Correo de su administrador</label>
            <input id="nn-correo" type="email" required>
            <p id="nn-error" class="error" role="alert"></p>
            <button class="btn" type="submit">Crear negocio</button>
          </form>
        </div>
        <div class="tarjeta">
          <h2>Invitar a un negocio</h2>
          <form id="form-invitar-negocio">
            <label for="ni-negocio">Negocio</label>
            <select id="ni-negocio"></select>
            <label for="ni-correo">Correo</label>
            <input id="ni-correo" type="email" required>
            <label for="ni-rol">Rol</label>
            <select id="ni-rol"><option value="administrador">Administrador</option><option value="empleado" selected>Colaborador</option></select>
            <p id="ni-error" class="error" role="alert"></p>
            <button class="btn" type="submit">Invitar</button>
          </form>
        </div>
      </div>
    </div>
    <div class="tarjeta">
      <h2>Pagos de la suscripción</h2>
      <p class="suave">Solo informativo. El administrador de cada negocio ve sus pagos en «Suscripción».</p>
      <form id="form-pago" class="fila-form pagos-form">
        <div><label for="np-negocio">Negocio</label><select id="np-negocio" required></select></div>
        <div><label for="np-fecha">Fecha del pago</label><input id="np-fecha" type="date" required value="${hoyISO()}"></div>
        <div><label for="np-valor">Valor</label><input id="np-valor" type="number" min="1" step="1" inputmode="numeric" required></div>
        <div><label for="np-nota">Nota (opcional)</label><input id="np-nota" maxlength="80" placeholder="Noviembre 2026"></div>
        <button class="btn" type="submit">Registrar pago</button>
      </form>
      <p id="np-error" class="error" role="alert"></p>
      <div id="np-lista"><p class="suave">Cargando…</p></div>
    </div>`,
  despues: () => {
    const nombre = $("#nn-nombre"), slug = $("#nn-slug"), vista = $("#nn-vista");
    let slugEditado = false;
    const mostrar = () => { vista.textContent = slug.value ? `Su enlace: ${enlacePublico(slug.value)}` : ""; };
    nombre.addEventListener("input", () => { if (!slugEditado) { slug.value = slugDe(nombre.value); mostrar(); } });
    slug.addEventListener("input", () => { slugEditado = true; mostrar(); });
    $("#form-negocio").addEventListener("submit", crearNegocio);
    $("#form-invitar-negocio").addEventListener("submit", invitarANegocio);
    $("#form-pago").addEventListener("submit", registrarPago);
    return cargarNegocios().then(cargarPagosDalu);
  },
};
