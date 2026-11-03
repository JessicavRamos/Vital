"use strict";

/* =====================================================================
   SUSCRIPCIÓN (solo administrador): lo que su negocio gana con DALU Vital.
   - Muestra el valor (lo logrado este mes) y no el gasto: no hay valores
     pagados ni sumas. La base solo le entrega (mi_suscripcion) la fecha del
     último pago, la de renovación, el valor actual de su plan y desde cuándo es cliente.
   - Comparador de planes con botón a WhatsApp de DALU para mejorar el plan.
   - Cómo pagar (DALU_MEDIOS_PAGO en config.js) y "Ya pagué" por WhatsApp.
   ===================================================================== */

const BENEFICIOS_PLAN = [
  ["recordatorios", "Recordatorios: a quién buscar hoy y mensaje por WhatsApp"],
  ["reportes", "Reportes y descarga en Excel"],
  ["respaldo", "Respaldo completo de tu información"],
  ["historia_clinica", "Historia clínica"],
];
const DIAS_GRACIAS_PAGO = 10; // días después de un pago en los que se muestra "Recibimos tu pago"

const mesYAnio = (f) => {
  const [a, m] = String(f).slice(0, 7).split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
};

async function cargarSuscripcion() {
  const caja = $("#s-estado");
  if (!caja) return;
  let datos = null, resumen = null, planes = [];
  const [rSus, rRes, rPlanes] = await Promise.allSettled([
    q(db.rpc("mi_suscripcion")), q(db.rpc("resumen_mes")), planesDisponibles(),
  ]);
  if (rSus.status === "fulfilled") datos = rSus.value[0] || null;
  if (rRes.status === "fulfilled") resumen = rRes.value[0] || null;
  if (rPlanes.status === "fulfilled") planes = rPlanes.value;
  if (!$("#s-estado")) return;

  const plan = estado.plan;
  const nombrePlan = (datos && datos.plan) || (plan && plan.nombre) || "";
  const est = estadoPago(datos && datos.proximo_pago);
  const precio = datos && Number(datos.precio_mensual) > 0 ? Number(datos.precio_mensual) : null;
  const pagoReciente = datos && datos.ultimo_pago && -diasHasta(datos.ultimo_pago) <= DIAS_GRACIAS_PAGO;

  // 1) Tu plan, renovación y gracias
  caja.innerHTML = `
    <div class="sus-cabeza">
      <div>
        <p class="sus-etiqueta">Tu plan</p>
        <h2 class="sus-plan">${nombrePlan ? esc(nombrePlan) : "—"}</h2>
        ${datos && datos.cliente_desde ? `<p class="suave sus-desde" id="s-desde">Cliente desde ${esc(mesYAnio(datos.cliente_desde))}</p>` : ""}
      </div>
      <span class="etiqueta ${est.clase}" id="s-estado-pago">${esc(est.texto)}</span>
    </div>
    ${pagoReciente ? `<p class="sus-gracias" id="s-gracias">✔ Recibimos tu pago del ${esc(fechaPago(datos.ultimo_pago))}.</p>` : ""}
    <div class="sus-fechas">
      <div><span>Tu plan se renueva el</span><b id="s-proximo">${esc(fechaPago(datos && datos.proximo_pago))}</b>
        ${precio ? `<small id="s-valor">Valor: ${esc(dinero(precio))}</small>` : ""}</div>
    </div>
    ${est.clase === "atrasada"
      ? `<p class="aviso-fijo">Tu renovación está pendiente desde el ${esc(fechaPago(datos.proximo_pago))}. Renueva para seguir usando ${esc(NOMBRE_PRODUCTO)} sin interrupciones.</p>`
      : est.aviso && est.dias < 0 ? `<p class="aviso-fijo">Tu renovación quedó pendiente. Si ya pagaste, avísanos y la registramos.</p>` : ""}
    <div class="sus-acciones">
      <a class="btn" href="#s-pagar" id="s-ir-pagar">Cómo pagar</a>
      <a class="btn alt" target="_blank" rel="noopener" id="s-ya-pague" href="${esc(enlaceDalu(mensajeYaPague()))}">Ya pagué, avisar a DALU</a>
    </div>`;
  $("#s-ir-pagar").addEventListener("click", (e) => { e.preventDefault(); $("#s-pagar").scrollIntoView({ behavior: "smooth" }); });

  // 2) Este mes con DALU Vital
  const mes = $("#s-mes");
  if (resumen) {
    const n = (k) => Number(resumen[k] || 0);
    const nombreMes = new Date().toLocaleDateString("es-CO", { month: "long", timeZone: ZONA });
    const vacio = !n("citas_agendadas") && !n("servicios");
    mes.innerHTML = `<h2>Tu ${esc(nombreMes)} con ${esc(NOMBRE_PRODUCTO)}</h2>
      ${vacio ? `<p class="suave">Tu mes apenas empieza. Agenda tus citas aquí y verás crecer estos números.</p>` : `
      <div class="stats stats-4" id="s-resumen">
        <div class="stat"><b>${n("citas_agendadas")}</b>Citas agendadas</div>
        <div class="stat"><b>${n("servicios")}</b>Servicios realizados</div>
        <div class="stat"><b>${n("mascotas_atendidas")}</b>Mascotas atendidas</div>
        <div class="stat"><b>${n("mascotas_regresaron")}</b>Mascotas que regresaron</div>
      </div>
      <p class="suave">${n("mascotas_nuevas") ? `<strong>${n("mascotas_nuevas")}</strong> ${n("mascotas_nuevas") === 1 ? "mascota llegó" : "mascotas llegaron"} por primera vez. ` : ""}${moduloActivo("recordatorios") ? "Los recordatorios por WhatsApp ayudan a que tus clientes regresen a tiempo." : ""}</p>`}`;
  } else {
    mes.hidden = true;
  }

  // 3) Cómo pagar
  const medios = typeof DALU_MEDIOS_PAGO !== "undefined" ? DALU_MEDIOS_PAGO : [];
  $("#s-pagar").innerHTML = `<h2>Cómo pagar</h2>
    ${medios.length ? `<ul class="medios-pago">${medios.map((m) => `<li><span><strong>${esc(m.nombre)}</strong> ${esc(m.numero)}</span>
      <button type="button" class="btn alt chico" data-copiar="${esc(String(m.numero).replace(/\s/g, ""))}">Copiar número</button></li>`).join("")}</ul>` : ""}
    <p class="suave">${precio ? `Valor de tu plan: <strong>${esc(dinero(precio))}</strong> al mes. ` : ""}Cuando pagues, envíanos el comprobante por WhatsApp y lo registramos.</p>
    <a class="btn" target="_blank" rel="noopener" href="${esc(enlaceDalu(mensajeYaPague()))}">Enviar comprobante por WhatsApp</a>`;
  $$("[data-copiar]", $("#s-pagar")).forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copiar); aviso("Número copiado."); }
    catch (error) { aviso(`Número: ${b.dataset.copiar}`); }
  }));

  // 4) Lo que incluye tu plan y comparador
  const incluido = $("#s-plan");
  if (!plan) { incluido.hidden = true; return; }
  const sedesActivas = estado.sedes.filter((x) => x.activo).length;
  const item = (si, texto) => `<li class="${si ? "si" : "no"}"><span class="marca" aria-hidden="true">${si ? "✔" : "✖"}</span><span>${texto}</span>${si ? "" : '<span class="oculto-visual"> (no incluido)</span>'}</li>`;
  incluido.innerHTML = `<h2>Lo que incluye tu plan</h2>
    <ul class="lista-plan beneficios">
      ${item(true, `Hasta <strong>${plan.max_sedes} ${plan.max_sedes === 1 ? "sede" : "sedes"}</strong> <span class="suave">(usas ${sedesActivas})</span>`)}
      ${item(true, `Hasta <strong>${plan.max_usuarios} usuarios</strong>`)}
      ${item(true, "Agenda, clientes, mascotas e historial")}
      ${BENEFICIOS_PLAN.map(([campo, texto]) => item(!!plan[campo], esc(texto))).join("")}
    </ul>`;

  // Solo su plan y los de arriba (no se ofrecen planes más baratos); en el plan más alto no se muestra.
  const comparar = $("#s-comparar");
  const actual = planes.find((p) => p.id === plan.id) || plan;
  planes = planes.filter((p) => p.orden >= actual.orden);
  if (planes.length < 2) { comparar.hidden = true; return; }
  const conPrecio = planes.some((p) => Number(p.precio_mensual) > 0);
  const celda = (p, contenido) => `<td class="${p.id === actual.id ? "plan-actual" : ""}">${contenido}</td>`;
  comparar.innerHTML = `<h2>Haz crecer tu negocio</h2>
    <div class="tabla-scroll"><table class="tabla-comparar">
      <thead><tr><th></th>${planes.map((p) => `<th class="${p.id === actual.id ? "plan-actual" : ""}">${esc(p.nombre)}${p.id === actual.id ? '<br><span class="etiqueta ok">Tu plan</span>' : ""}</th>`).join("")}</tr></thead>
      <tbody>
        ${conPrecio ? `<tr><td>Valor mensual</td>${planes.map((p) => celda(p, Number(p.precio_mensual) > 0 ? esc(dinero(p.precio_mensual)) : "—")).join("")}</tr>` : ""}
        <tr><td>Sedes</td>${planes.map((p) => celda(p, `Hasta ${p.max_sedes}`)).join("")}</tr>
        <tr><td>Usuarios</td>${planes.map((p) => celda(p, `Hasta ${p.max_usuarios}`)).join("")}</tr>
        <tr><td>Agenda, clientes e historial</td>${planes.map((p) => celda(p, "✔")).join("")}</tr>
        ${BENEFICIOS_PLAN.map(([campo, texto]) => `<tr><td>${esc(texto.split(":")[0])}</td>${planes.map((p) => celda(p, p[campo] ? "✔" : '<span class="suave">—</span>')).join("")}</tr>`).join("")}
        <tr><td></td>${planes.map((p) => celda(p, p.orden > actual.orden
          ? `<a class="btn chico" target="_blank" rel="noopener" data-quiero="${esc(p.id)}" href="${esc(enlaceDalu(mensajeMejorarPlan(p.nombre)))}">Quiero ${esc(p.nombre)}</a>` : "")).join("")}</tr>
      </tbody></table></div>
    <p class="suave">¿Tienes dudas sobre qué plan te conviene? <a target="_blank" rel="noopener" href="${esc(enlaceDalu(mensajeMejorarPlan(null)))}">Escríbenos por WhatsApp</a>.</p>`;
}

PANTALLAS.suscripcion = {
  html: () => `<h1>Suscripción</h1>
    <p class="suave">${esc(nombreNegocio())} en ${esc(NOMBRE_PRODUCTO)}.</p>
    <div class="tarjeta sus-tarjeta" id="s-estado"><p class="suave">Cargando…</p></div>
    <div class="tarjeta" id="s-mes"></div>
    <div class="columnas">
      <div class="tarjeta" id="s-plan"></div>
      <div class="tarjeta" id="s-pagar"></div>
    </div>
    <div class="tarjeta" id="s-comparar"></div>`,
  despues: cargarSuscripcion,
};
