-- =====================================================================
-- DALU Vital · v19 · La especie (perro / gato) en las vistas de Hoy
--   * agenda y pendientes ahora traen la columna "especie" de la mascota,
--     para mostrar el ícono de perro o gato junto al nombre en la pantalla Hoy.
--   * Solo AGREGA una columna al final de cada vista: lo que ya existía sigue igual.
--   * Si aún no corres este archivo, el sitio funciona igual, solo que sin el ícono.
-- Necesita el v13 (vistas con sedes). Córrelo en la base de PRUEBAS y luego en la REAL.
-- Va en una transacción: si algo falla, no cambia nada.
-- =====================================================================
begin;

create or replace view public.agenda with (security_invoker = true) as
SELECT ci.id, ci.fecha_hora, ci.estado, ci.motivo, ci.tipo_id, ci.precio_acordado, ci.precio_cobrado, ci.medicado,
       ci.recargo_medicado, gu.nombre AS guia, c.id AS cliente_id, c.nombre AS cliente, c.telefono, c.telefono2,
       m.id AS mascota_id, m.nombre AS mascota, t.nombre AS servicio,
       COALESCE(ci.precio_acordado, ps.precio_sugerido) AS precio,
       ci.sede_id, sd.nombre AS sede,
       m.especie
FROM public.citas ci
JOIN public.mascotas m ON m.id = ci.mascota_id
JOIN public.clientes c ON c.id = m.cliente_id
JOIN public.sedes sd ON sd.id = ci.sede_id
LEFT JOIN public.tipos_servicio t ON t.id = ci.tipo_id
LEFT JOIN public.guias gu ON gu.id = ci.guia_id
LEFT JOIN public.precios_sugeridos ps ON ps.mascota_id = ci.mascota_id AND ps.tipo_id = ci.tipo_id AND ps.sede_id = ci.sede_id;

create or replace view public.pendientes with (security_invoker = true) as
SELECT c.id AS cliente_id, c.nombre AS cliente, c.telefono, m.id AS mascota_id, m.nombre AS mascota, g.nombre AS grupo,
       max(s.fecha) AS ultima_fecha, (max(s.fecha) + g.frecuencia_dias) AS proxima_fecha,
       (CURRENT_DATE - (max(s.fecha) + g.frecuencia_dias)) AS dias_de_retraso,
       (array_agg(s.sede_id ORDER BY s.fecha DESC, s.id DESC))[1] AS ultima_sede_id,
       m.especie
FROM public.servicios s
JOIN public.mascotas m ON m.id = s.mascota_id
JOIN public.clientes c ON c.id = m.cliente_id
JOIN public.tipos_servicio t ON t.id = s.tipo_id
JOIN public.grupos_recordatorio g ON g.id = t.grupo_id
WHERE c.activo
GROUP BY c.id, c.nombre, c.telefono, m.id, m.nombre, m.especie, g.id, g.nombre, g.frecuencia_dias
HAVING (max(s.fecha) + g.frecuencia_dias) <= CURRENT_DATE;

-- Mismos permisos que antes (create or replace los conserva; se repiten por seguridad)
revoke all on public.agenda, public.pendientes from anon;
grant select on public.agenda, public.pendientes to authenticated, service_role;

commit;

-- Comprobar (debe salir "perro" o "gato" en la última columna):
-- select mascota, especie from public.agenda limit 5;
-- select mascota, especie from public.pendientes limit 5;
