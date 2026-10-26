"use strict";

/* =====================================================================
   SUSCRIPCIÓN (solo administrador): historial de pagos de este negocio a DALU Vital.
   Solo informativo: DALU registra los pagos; aquí solo se consultan.
   ===================================================================== */

async function cargarSuscripcion() {
  const caja = $("#s-pagos");
  if (!caja) return;
  try {
    let consulta = db.from("pagos").select("id,fecha,valor,nota").order("fecha", { ascending: false });
    // DALU puede ver los pagos de todos: aquí solo los de este negocio.
    if (estado.negocio && estado.negocio.id) consulta = consulta.eq("negocio_id", estado.negocio.id);
    const pagos = await q(consulta);
    if (!$("#s-pagos")) return;
    const ultimo = pagos[0];
    const total = pagos.reduce((suma, p) => suma + Number(p.valor || 0), 0);
    $("#s-resumen").innerHTML = `
      <div class="stat"><b>${ultimo ? esc(fechaCorta(ultimo.fecha)) : "—"}</b>Último pago</div>
      <div class="stat"><b>${ultimo ? esc(dinero(ultimo.valor)) : "—"}</b>Valor del último pago</div>
      <div class="stat"><b>${esc(dinero(total))}</b>Total pagado (${pagos.length} ${pagos.length === 1 ? "pago" : "pagos"})</div>`;
    tablaInteractiva(caja, {
      id: "pagos",
      filas: pagos,
      vacio: "Todavía no hay pagos registrados.",
      columnas: [
        { titulo: "Fecha", valor: (p) => p.fecha, filtro: false },
        { titulo: "Valor", valor: (p) => Number(p.valor), filtro: false },
        { titulo: "Nota", valor: (p) => p.nota ?? "", filtro: "texto" },
      ],
      fila: (p) => `<tr>
        <td>${esc(fechaCorta(p.fecha))}</td>
        <td>${esc(dinero(p.valor))}</td>
        <td>${esc(p.nota || "—")}</td>
      </tr>`,
    });
  } catch (error) {
    mostrarError(caja, error);
  }
}

PANTALLAS.suscripcion = {
  html: () => `<h1>Suscripción</h1>
    <p class="suave">Pagos de ${esc(nombreNegocio())} a ${esc(NOMBRE_PRODUCTO)}. Solo informativo: si ves algo raro, escríbele a DALU.</p>
    <div class="stats" id="s-resumen"></div>
    <div class="tarjeta"><div id="s-pagos"><p class="suave">Cargando…</p></div></div>`,
  despues: cargarSuscripcion,
};
