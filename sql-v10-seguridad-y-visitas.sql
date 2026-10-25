-- =====================================================================
-- Pet Garden · v10: seguridad, catálogos solo admin, descartes y visitas anteriores
-- NO borra ni cambia tus datos (citas, servicios, clientes, mascotas, precios).
-- Se puede ejecutar más de una vez. Necesita v4, v7 y v8 ya ejecutados.
-- =====================================================================

-- 1) Quien NO ha iniciado sesión (la llave pública del sitio) ya no puede leer tus datos.
--    Antes, las vistas (agenda, historial, mascotas_resumen, pendientes…) se podían leer
--    sin sesión porque Supabase da permiso de lectura a "anon" por defecto.
--    Solo se deja la tabla de videos, que se ve en la página pública.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;
grant select on public.videos to anon;
-- Lo que se cree en el futuro tampoco quedará abierto para "anon".
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

-- 2) Servicios y grupos de recordatorio: todos pueden VER; solo el administrador los cambia.
--    (Las Guías siguen disponibles para los dos roles.)
drop policy if exists "grupos_agregar_solo_admin" on public.grupos_recordatorio;
create policy "grupos_agregar_solo_admin" on public.grupos_recordatorio as restrictive for insert to authenticated
  with check (public.es_administrador());
drop policy if exists "grupos_cambiar_solo_admin" on public.grupos_recordatorio;
create policy "grupos_cambiar_solo_admin" on public.grupos_recordatorio as restrictive for update to authenticated
  using (public.es_administrador()) with check (public.es_administrador());
drop policy if exists "grupos_quitar_solo_admin" on public.grupos_recordatorio;
create policy "grupos_quitar_solo_admin" on public.grupos_recordatorio as restrictive for delete to authenticated
  using (public.es_administrador());

drop policy if exists "tipos_agregar_solo_admin" on public.tipos_servicio;
create policy "tipos_agregar_solo_admin" on public.tipos_servicio as restrictive for insert to authenticated
  with check (public.es_administrador());
drop policy if exists "tipos_cambiar_solo_admin" on public.tipos_servicio;
create policy "tipos_cambiar_solo_admin" on public.tipos_servicio as restrictive for update to authenticated
  using (public.es_administrador()) with check (public.es_administrador());
drop policy if exists "tipos_quitar_solo_admin" on public.tipos_servicio;
create policy "tipos_quitar_solo_admin" on public.tipos_servicio as restrictive for delete to authenticated
  using (public.es_administrador());

-- 3) Logo del negocio: solo el administrador lo sube o lo cambia (los demás archivos no cambian).
drop policy if exists "logo_subir_solo_admin" on storage.objects;
create policy "logo_subir_solo_admin" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'logo' or public.es_administrador());
drop policy if exists "logo_cambiar_solo_admin" on storage.objects;
create policy "logo_cambiar_solo_admin" on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'logo' or public.es_administrador());
drop policy if exists "logo_borrar_solo_admin" on storage.objects;
create policy "logo_borrar_solo_admin" on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'logo' or public.es_administrador());

-- 4) Si renombras un grupo (ej. "Spa" → "Spa completo"), los descartados de "A quién buscar"
--    se renombran también y no vuelven a aparecer.
create or replace function public.renombrar_grupo_en_descartes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.nombre is distinct from old.nombre then
    update public.pendientes_descartados set grupo = new.nombre where grupo = old.nombre;
  end if;
  return new;
end $$;
drop trigger if exists trg_renombrar_grupo_descartes on public.grupos_recordatorio;
create trigger trg_renombrar_grupo_descartes after update of nombre on public.grupos_recordatorio
  for each row execute function public.renombrar_grupo_en_descartes();

-- 5) Registrar una visita anterior (para mascotas que vinieron antes de usar el sistema).
--    Crea la cita ya realizada en ESA fecha y su servicio con esa misma fecha.
create or replace function public.registrar_visita_anterior(
  p_mascota_id bigint, p_tipo_id bigint, p_fecha date, p_hora text default '10:00',
  p_precio numeric default null, p_guia_id bigint default null, p_notas text default null,
  p_medicado boolean default false, p_recargo numeric default null)
returns bigint language plpgsql set search_path = public as $$
declare
  v_cita bigint;
  v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if p_fecha is null or p_fecha > v_hoy then
    raise exception 'La fecha de la visita anterior no puede ser futura.';
  end if;
  if p_tipo_id is null then
    raise exception 'Elige el servicio de la visita.';
  end if;
  insert into citas (mascota_id, tipo_id, fecha_hora, precio_acordado, estado, medicado, recargo_medicado)
  values (p_mascota_id, p_tipo_id, ((p_fecha::text || ' ' || coalesce(p_hora, '10:00'))::timestamp at time zone 'America/Bogota'),
          p_precio, 'pendiente', coalesce(p_medicado, false), case when p_medicado then p_recargo end)
  returning id into v_cita;
  -- Al pasar a "realizada" la base crea el servicio (como al presionar "Terminar").
  update citas set estado = 'realizada', precio_cobrado = p_precio, guia_id = p_guia_id, notas_servicio = p_notas
   where id = v_cita;
  -- Por si el disparador de la v7 no está, se asegura la fecha real de la visita.
  update servicios set fecha = p_fecha where cita_id = v_cita and fecha is distinct from p_fecha;
  return v_cita;
end $$;
revoke execute on function public.registrar_visita_anterior(bigint, bigint, date, text, numeric, bigint, text, boolean, numeric) from anon, public;
grant execute on function public.registrar_visita_anterior(bigint, bigint, date, text, numeric, bigint, text, boolean, numeric) to authenticated;

-- Comprobación: "anon_lee" debe salir "true" SOLO en videos.
select c.relname as objeto, case c.relkind when 'v' then 'vista' else 'tabla' end as tipo,
       has_table_privilege('anon', c.oid, 'select') as anon_lee
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'v')
order by anon_lee desc, tipo, objeto;
