"use strict";

/* =====================================================================
   SUSCRIPCIÓN (solo administrador): el plan de la empresa y su próximo pago.
   No muestra valores pagados ni sumas: la base solo le entrega (mi_suscripcion)
   la fecha del último pago, la del próximo y el valor actual de su plan.
   ===================================================================== */

const BENEFICIOS_PLAN = [
  ["recordatorios", "Recordatorios: a quién buscar hoy y mensaje por WhatsApp"],
  ["reportes", "Reportes y descarga en Excel"],
  ["respaldo", "Respaldo completo de tu información"],
  ["historia_clinica", "Historia clínica"],
];

async function cargarSuscripcion() {
  const caja = $("#s-estado");
  if (!caja) return;
  let datos = null;
  try {
    datos = (await q(db.rpc("mi_suscripcion")))[0] || null;
  } catch (error) {
    datos = null; // Base sin el SQL v14: se muestra solo el plan
  }
  if (!$("#s-estado")) return;
  const plan = estado.plan;
  const nombrePlan = (datos && datos.plan) || (plan && plan.nombre) || "";
  const est = estadoPago(datos && datos.proximo_pago);
  const precio = datos && Number(datos.precio_mensual) > 0 ? Number(datos.precio_mensual) : null;

  caja.innerHTML = `
    <div class="sus-cabeza">
      <div>
        <p class="sus-etiqueta">Tu plan</p>
        <h2 class="sus-plan">${nombrePlan ? esc(nombrePlan) : "—"}</h2>
      </div>
      <span class="etiqueta ${est.clase}" id="s-estado-pago">${esc(est.texto)}</span>
    </div>
    <div class="sus-fechas">
      <div><span>Último pago</span><b id="s-ultimo">${esc(fechaPago(datos && datos.ultimo_pago))}</b></div>
      <div><span>Próximo pago</span><b id="s-proximo">${esc(fechaPago(datos && datos.proximo_pago))}</b>
        ${precio ? `<small id="s-valor">Valor: ${esc(dinero(precio))}</small>` : ""}</div>
    </div>
    ${est.clase === "atrasada" ? `<p class="aviso-fijo">Tu pago está pendiente desde el ${esc(fechaPago(datos.proximo_pago))}. Si ya pagaste, avísale a DALU.</p>` : ""}`;

  const incluido = $("#s-plan");
  if (!plan) { incluido.hidden = true; return; }
  const sedesActivas = estado.sedes.filter((x) => x.activo).length;
  const tiene = BENEFICIOS_PLAN.filter(([campo]) => plan[campo]);
  const falta = BENEFICIOS_PLAN.filter(([campo]) => !plan[campo]);
  incluido.innerHTML = `<h2>Lo que incluye tu plan</h2>
    <ul class="lista-plan beneficios">
      <li>Hasta <strong>${plan.max_sedes} ${plan.max_sedes === 1 ? "sede" : "sedes"}</strong> <span class="suave">(usas ${sedesActivas})</span></li>
      <li>Hasta <strong>${plan.max_usuarios} usuarios</strong></li>
      <li>Agenda, clientes, mascotas e historial</li>
      ${tiene.map(([, texto]) => `<li>${esc(texto)}</li>`).join("")}
    </ul>
    ${falta.length ? `<p class="suave">¿Quieres más? Con un plan superior tienes también ${falta.map(([, t]) => esc(t.split(":")[0].toLowerCase())).join(", ")}, y más sedes y usuarios. Escríbele a DALU.</p>`
      : `<p class="suave">¿Necesitas más sedes o usuarios? Escríbele a DALU.</p>`}`;
}

PANTALLAS.suscripcion = {
  html: () => `<h1>Suscripción</h1>
    <p class="suave">${esc(nombreNegocio())} en ${esc(NOMBRE_PRODUCTO)}.</p>
    <div class="tarjeta sus-tarjeta" id="s-estado"><p class="suave">Cargando…</p></div>
    <div class="tarjeta" id="s-plan"></div>`,
  despues: cargarSuscripcion,
};
