// Supabase falso en memoria para las pruebas automáticas (no toca tu base real).
// Las pruebas lo cargan en lugar de la librería de Supabase.
// Parámetros en la dirección: ?empleado (entra como colaborador), ?sinsesion, ?muchas (1.200 mascotas extra),
// ?dalu (la usuaria es de DALU), ?sinnegocio (su usuario no tiene negocio), ?negocio=slug (negocio del visitante),
// ?dossedes (Pet Garden con 2 sedes), ?basico (Pet Garden en plan Básico), ?sinrecordatorios / ?sinreportes (plan sin ese módulo),
// ?pausado (DALU pausó a Pet Garden).
// Multinegocio: las filas con negocio_id se filtran como lo hace la base (RLS) cuando hay sesión.
(function () {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const dia = (n) => { const d = new Date(hoy + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const T = {
    razas: [
      { id: 1, nombre: "Criollo", especie: "perro", precio_bano: 30000, precio_corte: 35000, precio_corte_bano: 50000, recargo_medicado: 8000, precio_unas: 10000 },
      { id: 2, nombre: "Persa", especie: "gato", precio_bano: 40000, precio_corte: 45000, precio_corte_bano: 60000, recargo_medicado: 8000 },
    ],
    tipos_servicio: [{ id: 1, nombre: "Baño", grupo_id: 1 }, { id: 2, nombre: "Corte", grupo_id: 1 }, { id: 3, nombre: "Corte y baño", grupo_id: 1 }, { id: 4, nombre: "Uñas", grupo_id: 2 }],
    grupos_recordatorio: [{ id: 1, nombre: "Spa", frecuencia_dias: 30 }, { id: 2, nombre: "Uñas", frecuencia_dias: 30 }],
    guias: [{ id: 1, nombre: "#7", descripcion: null }, { id: 2, nombre: "#10", descripcion: null }],
    clientes: [
      { id: 1, nombre: "Ana", telefono: "3001234567", telefono2: "3159998877", notas: null, activo: true },
      { id: 2, nombre: "Carlos", telefono: "3105556677", telefono2: null, notas: null, activo: true },
    ],
    mascotas_resumen: [
      { mascota_id: 1, mascota: "Luna", especie: "perro", raza: "Criollo", raza_id: 1, cliente_id: 1, cliente: "Ana", telefono: "3001234567", telefono2: "3159998877", visitas: 7, ultima_visita: dia(-35), activo: true, descripcion_corte: "Guía 7" },
      { mascota_id: 2, mascota: "Simba", especie: "gato", raza: "Persa", raza_id: 2, cliente_id: 1, cliente: "Ana", telefono: "3001234567", telefono2: "3159998877", visitas: 2, ultima_visita: dia(-40), activo: true },
      { mascota_id: 3, mascota: "Rocky", especie: "perro", raza: null, raza_id: null, cliente_id: 2, cliente: "Carlos", telefono: "3105556677", telefono2: null, visitas: 0, ultima_visita: null, activo: true },
    ],
    historial: [],
    servicios: [],
    citas: [],
    agenda: [],
    pendientes: [
      { mascota_id: 1, cliente_id: 1, mascota: "Luna", cliente: "Ana", telefono: "3001234567", grupo: "Spa", ultima_fecha: dia(-35), dias_de_retraso: 5 },
      { mascota_id: 2, cliente_id: 1, mascota: "Simba", cliente: "Ana", telefono: "3001234567", grupo: "Spa", ultima_fecha: dia(-40), dias_de_retraso: 10 },
    ],
    pendientes_descartados: [],
    servicios_anulados: [],
    planes: [
      { id: "basico", nombre: "Básico", orden: 1, max_sedes: 1, max_usuarios: 3, recordatorios: true, reportes: true, respaldo: true, historia_clinica: false },
      { id: "profesional", nombre: "Profesional", orden: 2, max_sedes: 2, max_usuarios: 8, recordatorios: true, reportes: true, respaldo: true, historia_clinica: true },
      { id: "premium", nombre: "Premium", orden: 3, max_sedes: 5, max_usuarios: 20, recordatorios: true, reportes: true, respaldo: true, historia_clinica: true },
    ],
    negocios: [
      { id: 1, nombre: "Pet Garden", slug: "petgarden", activo: !location.search.includes("pausado"), creado_en: "2026-10-01T15:00:00Z",
        plan_id: location.search.includes("basico") ? "basico" : "premium" },
      { id: 2, nombre: "Vet Norte", slug: "vet-norte", activo: true, creado_en: "2026-10-20T15:00:00Z", plan_id: "basico" },
    ],
    sedes: [
      { id: 1, negocio_id: 1, nombre: "Sede principal", activo: true, creado_en: "2026-10-01T15:00:00Z" },
      ...(location.search.includes("dossedes") ? [{ id: 2, negocio_id: 1, nombre: "Sede Norte", activo: true, creado_en: "2026-10-25T15:00:00Z" }] : []),
      { id: 3, negocio_id: 2, nombre: "Sede principal", activo: true, creado_en: "2026-10-20T15:00:00Z" },
    ],
    usuarios_sedes: [{ usuario_id: "u1", sede_id: 1 }, { usuario_id: "u2", sede_id: 1 }],
    precios_sede: [],
    invitaciones: [],
    pagos: [
      { id: 1, negocio_id: 1, fecha: "2026-09-05", valor: 80000, nota: "Septiembre 2026" },
      { id: 2, negocio_id: 1, fecha: "2026-10-05", valor: 80000, nota: "Octubre 2026" },
      { id: 3, negocio_id: 2, fecha: "2026-10-20", valor: 95000, nota: "Pago de Vet Norte" },
    ],
    perfiles: [
      { id: 'u1', correo: 'a@b.co', nombre: 'Jessica', rol: (location.search.includes('empleado') ? 'empleado' : 'administrador'), creado_en: '2026-10-01T15:00:00Z',
        negocio_id: location.search.includes('sinnegocio') ? null : 1 },
      { id: 'u2', correo: 'andres@x.co', nombre: 'Andrés', rol: 'empleado', creado_en: '2026-10-10T15:00:00Z', negocio_id: 1 },
      { id: 'u3', correo: 'otra@vetnorte.co', nombre: 'Laura', rol: 'administrador', creado_en: '2026-10-20T15:00:00Z', negocio_id: 2 },
    ],
    ultima_guia: [{ mascota_id: 1, guia_id: 1, guia: "#7", fecha: dia(-35) }],
    precios_sugeridos: [{ mascota_id: 1, tipo_id: 1, precio_sugerido: 40000, origen: "mascota", recargo_medicado: null }],
    videos: [
      { id: 1, especie: "perro", categoria: "Comida", titulo: "Croquetas premium", archivo: null, youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", activo: true },
      { id: 2, especie: "perro", categoria: "Juguetes", titulo: "Pelota mordedora", archivo: null, youtube_url: "https://youtu.be/dQw4w9WgXcQ", activo: true },
      { id: 3, especie: "perro", categoria: "Comida", titulo: "Snack dental", archivo: null, youtube_url: "https://www.youtube.com/shorts/dQw4w9WgXcQ", activo: false },
      { id: 4, especie: "gato", categoria: "Arena", titulo: "Arena aglomerante", archivo: null, youtube_url: "https://youtu.be/dQw4w9WgXcQ" },
      { id: 5, especie: "perro", categoria: "Comida", titulo: "Solo de Vet Norte", archivo: null, youtube_url: "https://youtu.be/dQw4w9WgXcQ", activo: true, negocio_id: 2 },
    ],
  };
  // 12 servicios de Luna y 2 de Simba
  let sid = 1, cid = 1;
  for (let i = 0; i < 12; i++) {
    const f = dia(-35 - i * 30);
    T.citas.push({ id: cid, fecha_hora: f + "T15:30:00.000Z", estado: "realizada" });
    T.servicios.push({ id: sid, cita_id: cid, tipo_id: 1, fecha: f, guia_id: 1, precio_cobrado: 40000, medicado: i === 0, recargo_medicado: i === 0 ? 8000 : null, notas: null });
    T.historial.push({ id: sid, mascota_id: 1, cliente_id: 1, mascota: "Luna", servicio: "Baño", fecha: f, guia: "#7", precio_cobrado: i === 0 ? 48000 : 40000, medicado: i === 0, notas: null });
    sid++; cid++;
  }
  for (let i = 0; i < 2; i++) {
    const f = dia(-40 - i * 30);
    T.historial.push({ id: sid, mascota_id: 2, cliente_id: 1, mascota: "Simba", servicio: "Corte", fecha: f, guia: null, precio_cobrado: 45000, medicado: false });
    T.servicios.push({ id: sid, cita_id: null, tipo_id: 2, fecha: f, precio_cobrado: 45000 });
    sid++;
  }
  // Citas de hoy
  T.agenda.push(
    { id: 100, fecha_hora: hoy + "T14:00:00.000Z", mascota_id: 1, mascota: "Luna", cliente: "Ana", telefono: "3001234567", telefono2: "3159998877", servicio: "Baño", tipo_id: 1, estado: "pendiente", precio_acordado: 40000, medicado: false },
    { id: 101, fecha_hora: hoy + "T16:00:00.000Z", mascota_id: 3, mascota: "Rocky", cliente: "Carlos", telefono: "3105556677", servicio: "Corte", tipo_id: 2, estado: "realizada", precio_cobrado: 35000, medicado: false, guia: "#10" },
    { id: 102, fecha_hora: hoy + "T18:00:00.000Z", mascota_id: 2, mascota: "Simba", cliente: "Ana", telefono: "3001234567", servicio: "Corte y baño", tipo_id: 3, estado: "cancelada", precio_acordado: 60000 },
  );
  T.citas.push({ id: 100, estado: "pendiente" }, { id: 101, estado: "realizada" }, { id: 102, estado: "cancelada" });
  T.servicios.push({ id: 500, cita_id: 101, tipo_id: 2, fecha: hoy, precio_cobrado: 35000 });
  T.historial.push({ id: 500, mascota_id: 3, cliente_id: 2, mascota: "Rocky", servicio: "Corte", fecha: hoy, precio_cobrado: 35000 });
  if (location.search.includes("muchas")) {
    for (let i = 0; i < 1200; i++) T.mascotas_resumen.push({ mascota_id: 1000 + i, mascota: "Extra " + String(i).padStart(4, "0"), especie: "perro", raza: "Criollo", raza_id: 1, cliente_id: 2, cliente: "Carlos", telefono: "3105556677", visitas: 0, ultima_visita: null, activo: true });
  }
  const esEmpleado = location.search.includes("empleado");
  // Lo que la base (RLS) no le deja cambiar al colaborador: la actualización no devuelve filas.
  const SOLO_ADMIN = { pagos: ["insert", "update", "delete"], razas: ["insert", "update", "delete"], grupos_recordatorio: ["insert", "update", "delete"], tipos_servicio: ["insert", "update", "delete"], videos: ["delete"] };
  // Los videos de prueba sin negocio son de Pet Garden (negocio 1).
  T.videos.forEach((v) => { if (v.negocio_id === undefined) v.negocio_id = 1; });
  // Planes con módulos apagados (para probar los límites del plan)
  if (location.search.includes("sinrecordatorios")) T.planes.forEach((p) => { p.recordatorios = false; });
  if (location.search.includes("sinreportes")) T.planes.forEach((p) => { p.reportes = false; });
  // Todo lo que ya existe es de la sede principal; los precios de las razas quedan en la sede 1 (y en la 2 si existe)
  ["agenda", "citas", "servicios", "historial"].forEach((t) => T[t].forEach((r) => { if (r.sede_id === undefined) { r.sede_id = 1; r.sede = "Sede principal"; } }));
  T.pendientes.forEach((p) => { p.ultima_sede_id = 1; });
  T.sedes.filter((x) => x.negocio_id === 1).forEach((sd) => T.razas.forEach((r) => T.precios_sede.push({
    negocio_id: 1, sede_id: sd.id, raza_id: r.id, precio_bano: r.precio_bano, precio_corte: r.precio_corte,
    precio_corte_bano: r.precio_corte_bano, precio_unas: r.precio_unas ?? null, recargo_medicado: r.recargo_medicado })));
  T.razas.forEach((r) => { r.negocio_id = 1; });
  window.__T = T;
  window.__log = [];

  class B {
    constructor(t) { this.t = t; this.f = []; this.op = "select"; this.o = []; this.lim = null; this.rg = null; this.one = false; this.ret = false; }
    select(_c, opts) { if (this.op !== "select") this.ret = true; this.cnt = opts && opts.count; return this; }
    eq(c, v) { this.f.push((r) => r[c] === v); return this; }
    neq(c, v) { this.f.push((r) => r[c] !== v); return this; }
    gte(c, v) { this.f.push((r) => r[c] != null && r[c] >= v); return this; }
    lte(c, v) { this.f.push((r) => r[c] != null && r[c] <= v); return this; }
    lt(c, v) { this.f.push((r) => r[c] != null && r[c] < v); return this; }
    in(c, vs) { this.f.push((r) => vs.includes(r[c])); return this; }
    or() { return this; }
    order(c, o) { this.o.push([c, !o || o.ascending !== false]); return this; }
    limit(n) { this.lim = n; return this; }
    range(a, b) { this.rg = [a, b]; return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.one = true; this.maybe = true; return this; }
    insert(d) { this.op = "insert"; this.d = d; return this; }
    upsert(d, o) { this.op = "upsert"; this.d = d; this.conflicto = ((o && o.onConflict) || "id").split(","); return this; }
    update(d) { this.op = "update"; this.d = d; return this; }
    delete() { this.op = "delete"; return this; }
    then(ok, ko) { return Promise.resolve(this.run()).then(ok, ko); }
    run() {
      window.__log.push([this.op, this.t, this.d]);
      if (this.t === "razas_sede") {
        T.razas_sede = [];
        T.sedes.forEach((sd) => T.razas.filter((r) => r.negocio_id === sd.negocio_id).forEach((r) => {
          const p = T.precios_sede.find((x) => x.sede_id === sd.id && x.raza_id === r.id) || {};
          T.razas_sede.push({ sede_id: sd.id, id: r.id, nombre: r.nombre, especie: r.especie, negocio_id: r.negocio_id,
            precio_bano: p.precio_bano ?? null, precio_corte: p.precio_corte ?? null, precio_corte_bano: p.precio_corte_bano ?? null,
            precio_unas: p.precio_unas ?? null, recargo_medicado: p.recargo_medicado ?? null });
        }));
      }
      if (!T[this.t]) return { data: null, error: { message: `relation "public.${this.t}" does not exist` } };
      const tabla = T[this.t];
      const mi = miNegocio();
      // Como la base: con sesión solo se ven las filas del propio negocio (DALU ve todos los perfiles y negocios).
      const deMiNegocio = (r) => !sesion || r.negocio_id === undefined || r.negocio_id === mi ||
        (esDalu && ["perfiles", "invitaciones", "pagos"].includes(this.t));
      const pausado = sesion && !esDalu && !(T.negocios.find((n) => n.id === mi) || {}).activo;
      const pasa = (r) => (this.t === "negocios" || this.t === "planes" || (deMiNegocio(r) && !(pausado && r.negocio_id !== undefined && this.t !== "perfiles")))
        && this.f.every((fn) => fn(r));
      if (esEmpleado && (SOLO_ADMIN[this.t] || []).includes(this.op)) {
        if (this.op === "insert") return { data: null, error: { message: 'new row violates row-level security policy for table "' + this.t + '"' } };
        return { data: [], error: null };
      }
      if (this.op === "upsert") {
        const filas = (Array.isArray(this.d) ? this.d : [this.d]).map((x) => {
          const existe = tabla.find((r) => this.conflicto.every((k) => r[k] === x[k]));
          if (existe) return Object.assign(existe, x);
          const nueva = { negocio_id: mi, ...x };
          tabla.push(nueva);
          return nueva;
        });
        return { data: this.ret ? filas : null, error: null };
      }
      if (this.t === "sedes" && this.op === "insert") {
        const plan = T.planes.find((p) => p.id === (T.negocios.find((n) => n.id === mi) || {}).plan_id);
        if (T.sedes.filter((x) => x.negocio_id === mi && x.activo).length >= plan.max_sedes) {
          return { data: null, error: { message: `Tu plan permite ${plan.max_sedes} sede(s). Para agregar más, cambia de plan con DALU.` } };
        }
      }
      if (this.op === "insert") {
        const base = this.t === "sedes" ? { activo: true, creado_en: new Date().toISOString() } : {};
        const filas = (Array.isArray(this.d) ? this.d : [this.d]).map((x) => ({ id: Math.floor(Math.random() * 1e6), negocio_id: mi, ...base, ...x }));
        tabla.push(...filas); return { data: this.ret ? filas : null, error: null };
      }
      if (this.op === "update") { const fs = tabla.filter(pasa); fs.forEach((r) => Object.assign(r, this.d)); return { data: this.ret ? fs : null, error: null }; }
      if (this.op === "delete") {
        const fs = tabla.filter(pasa); T[this.t] = tabla.filter((r) => !pasa(r));
        if (this.t === "servicios") { const ids = fs.map((x) => x.id); T.historial = T.historial.filter((h) => !ids.includes(h.id)); }
        if (this.t === "citas") { const ids = fs.map((x) => x.id); T.agenda = T.agenda.filter((h) => !ids.includes(h.id)); }
        return { data: this.ret ? fs : null, error: null };
      }
      let fs = tabla.filter(pasa);
      for (const [c, asc] of [...this.o].reverse()) fs = fs.slice().sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
      if (this.rg) fs = fs.slice(this.rg[0], this.rg[1] + 1);
      if (this.lim) fs = fs.slice(0, this.lim);
      if (this.cnt) return { count: fs.length, data: null, error: null };
      if (this.t === "perfiles") fs = fs.map((p) => {
        const n = T.negocios.find((x) => x.id === p.negocio_id && (x.activo || esDalu));
        return { ...p, negocios: n ? { ...n, planes: T.planes.find((pl) => pl.id === n.plan_id) || null } : null };
      });
      if (this.one) return { data: fs[0] || null, error: fs[0] || this.maybe ? null : { message: "no rows" } };
      return { data: JSON.parse(JSON.stringify(fs)), error: null };
    }
  }
  let sesion = { user: { id: "u1", email: "a@b.co", user_metadata: { nombre: "Jessica" } } };
  const esDalu = location.search.includes("dalu");
  function miNegocio() { const p = T.perfiles.find((x) => sesion && x.id === sesion.user.id); return p ? p.negocio_id : null; }
  if (location.search.includes("sinsesion")) sesion = null;
  let oyente = null;
  window.supabase = {
    createClient: () => ({
      from: (t) => new B(t),
      rpc: (n, d) => {
        window.__log.push(["rpc", n, d]);
        const ahora = new Date().toISOString();
        const anular = (sid, motivo) => {
          const sv = T.servicios.find((x) => x.id === sid); if (!sv) return "El servicio no existe o ya fue anulado.";
          const h = T.historial.find((x) => x.id === sid) || {};
          T.servicios_anulados.push({ id: Math.random(), servicio_id: sid, cita_id: sv.cita_id, mascota_id: h.mascota_id, fecha: sv.fecha, servicio: h.servicio, precio_cobrado: sv.precio_cobrado, motivo, anulado_por: "Jessica", anulado_en: ahora });
          T.servicios = T.servicios.filter((x) => x.id !== sid); T.historial = T.historial.filter((x) => x.id !== sid);
          if (sv.cita_id) cancelar(sv.cita_id, motivo);
        };
        const cancelar = (cid, motivo) => {
          const a = T.agenda.find((x) => x.id === cid); if (a) a.estado = "cancelada";
          const c = T.citas.find((x) => x.id === cid); if (c) Object.assign(c, { estado: "cancelada", cancelada_por: "Jessica", cancelada_en: ahora, motivo_cancelacion: motivo });
        };
        if (n === "anular_servicio") { const e = anular(d.p_servicio_id, d.p_motivo); return Promise.resolve({ data: null, error: e ? { message: e } : null }); }
        if (n === "cancelar_cita") {
          const sv = T.servicios.find((x) => x.cita_id === d.p_cita_id);
          const ya = T.citas.find((x) => x.id === d.p_cita_id);
          if (!sv && ya && ya.estado === "cancelada") return Promise.resolve({ data: null, error: { message: "La cita no existe o ya estaba cancelada." } });
          if (sv) anular(sv.id, d.p_motivo); else cancelar(d.p_cita_id, d.p_motivo);
          return Promise.resolve({ data: null, error: null });
        }
        if (n === "es_dalu") return Promise.resolve({ data: esDalu, error: null });
        if (n === "mis_sedes") {
          const perfil = T.perfiles.find((x) => x.id === sesion.user.id) || {};
          const ids = perfil.rol === "administrador"
            ? T.sedes.filter((x) => x.negocio_id === miNegocio()).map((x) => x.id)
            : T.usuarios_sedes.filter((x) => x.usuario_id === sesion.user.id).map((x) => x.sede_id);
          return Promise.resolve({ data: ids, error: null });
        }
        if (n === "uso_negocios") return Promise.resolve({ data: T.negocios.map((ng) => ({
          negocio_id: ng.id,
          sedes: T.sedes.filter((x) => x.negocio_id === ng.id && x.activo).length,
          usuarios: T.perfiles.filter((x) => x.negocio_id === ng.id).length,
          invitaciones: T.invitaciones.filter((x) => x.negocio_id === ng.id).length })), error: null });
        if (n === "invitar_usuario") {
          const correo = String(d.p_correo || "").toLowerCase();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return Promise.resolve({ data: null, error: { message: "Escribe un correo válido." } });
          if (T.perfiles.some((p) => p.correo === correo && p.negocio_id)) return Promise.resolve({ data: null, error: { message: "Ese correo ya tiene acceso a un negocio y no se puede invitar." } });
          const negocioId = d.p_negocio_id || miNegocio();
          const plan = T.planes.find((pl) => pl.id === (T.negocios.find((x) => x.id === negocioId) || {}).plan_id);
          if (plan && T.perfiles.filter((x) => x.negocio_id === negocioId).length
              + T.invitaciones.filter((x) => x.negocio_id === negocioId && x.correo !== correo).length >= plan.max_usuarios) {
            return Promise.resolve({ data: null, error: { message: `Tu plan permite ${plan.max_usuarios} usuarios. Para agregar más, cambia de plan con DALU.` } });
          }
          T.invitaciones = T.invitaciones.filter((i) => i.correo !== correo);
          T.invitaciones.push({ correo, rol: d.p_rol, negocio_id: negocioId, creado_en: ahora, sedes: d.p_sedes || null });
          return Promise.resolve({ data: "invitado", error: null });
        }
        if (n === "crear_negocio") {
          if (!esDalu) return Promise.resolve({ data: null, error: { message: "Solo DALU puede crear negocios." } });
          if (T.negocios.some((x) => x.slug === d.p_slug)) return Promise.resolve({ data: null, error: { message: 'duplicate key value violates unique constraint "negocios_slug_key"' } });
          const id = T.negocios.length + 1;
          T.negocios.push({ id, nombre: d.p_nombre, slug: d.p_slug, activo: true, creado_en: ahora, plan_id: d.p_plan || "basico" });
          T.invitaciones.push({ correo: d.p_correo_admin, rol: "administrador", negocio_id: id, creado_en: ahora });
          return Promise.resolve({ data: id, error: null });
        }
        if (n === "registrar_visita_anterior") {
          const m = T.mascotas_resumen.find((x) => x.mascota_id === d.p_mascota_id) || {};
          const tipo = T.tipos_servicio.find((x) => x.id === d.p_tipo_id) || {};
          const id = 9000 + T.historial.length;
          T.historial.push({ id, mascota_id: d.p_mascota_id, cliente_id: m.cliente_id, mascota: m.mascota, servicio: tipo.nombre, fecha: d.p_fecha, precio_cobrado: d.p_precio, medicado: d.p_medicado, notas: d.p_notas });
          return Promise.resolve({ data: id, error: null });
        }
        return Promise.resolve({ data: [{ o_cliente_nuevo: true, o_mascota_nueva: true }], error: null });
      },
      auth: {
        getSession: async () => ({ data: { session: sesion } }),
        onAuthStateChange: (fn) => { oyente = fn; return { data: { subscription: {} } }; },
        signInWithPassword: async () => ({ error: { message: "Invalid login credentials" } }),
        signOut: async () => { sesion = null; oyente && oyente("SIGNED_OUT", null); return {}; },
        updateUser: async (d) => { window.__log.push(["updateUser", d]); return { data: { user: sesion && sesion.user }, error: null }; },
        resetPasswordForEmail: async (e, o) => { window.__log.push(["reset", e, o]); return { error: null }; },
        signUp: async (d) => {
          window.__log.push(["signUp", d.email, d.options]);
          if (!T.invitaciones.some((i) => i.correo === d.email.toLowerCase())) return { data: {}, error: { message: "Database error saving new user" } };
          return { data: { session: null, user: { email: d.email } }, error: null };
        },
      },
      storage: { from: (b) => ({
        list: async (carpeta) => { window.__log.push(["list", b, carpeta]); return { data: [], error: null }; },
        getPublicUrl: (n) => ({ data: { publicUrl: "https://x/" + n } }),
        upload: async (n) => { window.__log.push(["upload", b, n]); return {}; },
        remove: async (ns) => { window.__log.push(["remove", b, ns]); return {}; } }) },
    }),
  };
})();
