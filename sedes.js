"use strict";

/* =====================================================================
   SEDES (solo administrador): las sedes de la empresa.
   - Clientes, mascotas e historial son de toda la empresa.
   - La agenda es de cada sede, y cada sede tiene sus propios precios (Catálogos).
   - El plan define cuántas sedes activas se pueden tener (lo hace cumplir la base).
   ===================================================================== */

async function cargarSedesPantalla() {
  const caja = $("#sd-lista");
  if (!caja) return;
  try {
    const sedes = await q(db.from("sedes").select("id,nombre,activo,creado_en").eq("negocio_id", estado.negocio.id).order("id"));
    if (!$("#sd-lista")) return;
    const activas = sedes.filter((x) => x.activo).length;
    const max = estado.plan ? estado.plan.max_sedes : null;
    $("#sd-plan").innerHTML = max
      ? `Tu plan <strong>${esc(estado.plan.nombre)}</strong> permite <strong>${max}</strong> ${max === 1 ? "sede" : "sedes"} activas. Tienes <strong>${activas}</strong>.`
      : `Tienes <strong>${activas}</strong> ${activas === 1 ? "sede activa" : "sedes activas"}.`;
    const lleno = max !== null && activas >= max;
    $("#form-sede button[type=submit]").disabled = lleno;
    $("#sd-lleno").hidden = !lleno;
    if (lleno) pintarAvisoLimite($("#sd-lleno"), "max_sedes", "sedes");
    caja.innerHTML = `<div class="tabla-scroll"><table><thead><tr><th>Sede</th><th>Estado</th><th></th></tr></thead>
      <tbody id="tabla-sedes">${sedes.map((x) => `<tr data-id="${x.id}">
        <td><input data-campo="nombre" value="${esc(x.nombre)}" aria-label="Nombre de la sede"></td>
        <td>${x.activo ? '<span class="etiqueta ok">Activa</span>' : '<span class="etiqueta gris">Pausada</span>'}</td>
        <td><button type="button" class="btn alt chico" data-activo="${x.id}"${x.activo && activas === 1 ? ' disabled title="Debe quedar al menos una sede activa"' : ""}>${x.activo ? "Pausar" : "Activar"}</button></td>
      </tr>`).join("")}</tbody></table></div>`;
    $("#tabla-sedes").addEventListener("change", async (evento) => {
      const entrada = evento.target;
      const fila = entrada.closest("tr[data-id]");
      if (!fila) return;
      const nombre = entrada.value.trim();
      if (!nombre) { aviso("El nombre no puede quedar vacío.", true); return cargarSedesPantalla(); }
      try {
        const filas = await q(db.from("sedes").update({ nombre }).eq("id", Number(fila.dataset.id)).select("id"));
        if (!filas.length) throw new Error("permission denied");
        aviso("Guardado.");
        await cargarSedes();
      } catch (error) {
        aviso(mensajeError(error), true);
        cargarSedesPantalla();
      }
    });
    $$("[data-activo]", caja).forEach((b) => b.addEventListener("click", () =>
      cambiarActivoSede(sedes.find((x) => x.id === Number(b.dataset.activo)))));
  } catch (error) {
    mostrarError(caja, error);
  }
}

async function cambiarActivoSede(sede) {
  const pausar = sede.activo;
  if (!(await confirmar({
    titulo: pausar ? `¿Pausar ${sede.nombre}?` : `¿Activar ${sede.nombre}?`,
    texto: pausar
      ? "Su agenda deja de aparecer para agendar. Sus citas y servicios no se borran y siguen en el historial."
      : "Vuelve a aparecer para agendar.",
    boton: pausar ? "Sí, pausar" : "Sí, activar",
  }))) return;
  try {
    const filas = await q(db.from("sedes").update({ activo: !pausar }).eq("id", sede.id).select("id"));
    if (!filas.length) throw new Error("permission denied");
    aviso(`${sede.nombre} quedó ${pausar ? "pausada" : "activa"}.`);
    await cargarSedes();
    montarPantalla("sedes");
  } catch (error) {
    aviso(mensajeError(error), true);
  }
}

async function agregarSede(evento) {
  evento.preventDefault();
  const error = $("#sd-error");
  error.textContent = "";
  const nombre = $("#sd-nombre").value.trim();
  if (!nombre) return;
  try {
    await q(db.from("sedes").insert({ nombre }));
    aviso(`${nombre} quedó creada con los precios de tu primera sede. Ajústalos en Catálogos.`);
    await cargarSedes();
    montarPantalla("sedes");
  } catch (fallo) {
    error.textContent = mensajeError(fallo);
  }
}

PANTALLAS.sedes = {
  html: () => `<h1>Sedes</h1>
    <p class="suave">Clientes, mascotas e historial son de toda la empresa: una mascota puede ir a cualquier sede.
    La <strong>agenda</strong> y los <strong>precios</strong> son de cada sede. Asigna a tus colaboradores sus sedes en <strong>Usuarios</strong>.</p>
    <p id="sd-plan" class="suave"></p>
    <div class="columnas derecha">
      <div class="tarjeta"><div id="sd-lista"><p class="suave">Cargando…</p></div></div>
      <div class="tarjeta">
        <h2>Agregar una sede</h2>
        <form id="form-sede">
          <label for="sd-nombre">Nombre de la sede</label>
          <input id="sd-nombre" maxlength="60" required placeholder="Sede Norte">
          <p id="sd-error" class="error" role="alert"></p>
          <p id="sd-lleno" class="aviso-fijo" hidden>Llegaste al máximo de sedes de tu plan. Para agregar más, cambia de plan con DALU.</p>
          <button class="btn" type="submit">Agregar sede</button>
        </form>
      </div>
    </div>`,
  despues: () => {
    $("#form-sede").addEventListener("submit", agregarSede);
    return cargarSedesPantalla();
  },
};
