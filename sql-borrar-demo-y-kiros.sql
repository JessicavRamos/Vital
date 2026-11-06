-- =====================================================================
-- DALU Vital · Borrar las empresas de prueba "Demo" y "Kiros"
-- Borra TODO lo de esas dos empresas: sedes, precios, catálogos, clientes,
-- citas, servicios, invitaciones, pagos, sus usuarios y las cuentas de sus
-- correos. Es un solo bloque: si algo no cuadra, se detiene y no borra nada.
-- Pet Garden no se toca. ¡No se puede deshacer!
-- =====================================================================
do $$
declare
  v_ids bigint[];
  v_correos text[];
  t text;
  r record;
  n bigint;
begin
  select array_agg(id) into v_ids from public.negocios where slug in ('demo', 'kiros');

  if v_ids is null or array_length(v_ids, 1) <> 2 then
    raise exception 'Alto: se esperaban 2 empresas (demo y kiros) y hay %.', coalesce(array_length(v_ids, 1), 0);
  end if;
  if 1 = any(v_ids) or exists (select 1 from public.negocios where id = any(v_ids) and nombre ilike '%pet garden%') then
    raise exception 'Alto: Pet Garden no se puede borrar.';
  end if;

  -- Correos de sus usuarios e invitaciones (para borrar también sus cuentas)
  select array_agg(distinct c) into v_correos from (
    select lower(correo) as c from public.invitaciones where negocio_id = any(v_ids)
    union
    select lower(correo) from public.perfiles where negocio_id = any(v_ids) and correo is not null
  ) x;

  delete from public.usuarios_sedes where sede_id in (select id from public.sedes where negocio_id = any(v_ids));
  delete from public.precios_sede where negocio_id = any(v_ids);

  foreach t in array array['servicios_anulados', 'pendientes_descartados', 'servicios', 'citas', 'mascotas', 'clientes',
                           'razas', 'guias', 'tipos_servicio', 'grupos_recordatorio', 'videos', 'invitaciones', 'pagos'] loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I where negocio_id = any($1)', t) using v_ids;
    end if;
  end loop;

  -- Usuarios: su perfil y su cuenta (solo si no pertenecen a otra empresa)
  delete from public.perfiles where negocio_id = any(v_ids);
  delete from auth.users u
  where lower(u.email) = any(coalesce(v_correos, '{}'))
    and not exists (select 1 from public.perfiles p where p.id = u.id);

  delete from public.sedes where negocio_id = any(v_ids);
  delete from public.negocios where id = any(v_ids);

  -- Nada debe quedar apuntando a esas empresas
  for r in select c.table_name from information_schema.columns c
           join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
           where c.table_schema = 'public' and c.column_name = 'negocio_id' and tb.table_type = 'BASE TABLE' loop
    execute format('select count(*) from public.%I where negocio_id = any($1)', r.table_name) into n using v_ids;
    if n > 0 then raise exception 'Alto: quedaron % filas en %.', n, r.table_name; end if;
  end loop;

  raise notice 'Listo: se borraron Demo y Kiros (% correos).', coalesce(array_length(v_correos, 1), 0);
end $$;

-- Comprobación: solo debe quedar Pet Garden y ninguna cuenta de esos correos
select n.id, n.nombre, n.slug,
       (select count(*) from auth.users u where lower(u.email) in ('jessicaramos@fymtech.com', 'kiroscolombia@gmail.com')) as cuentas_de_esos_correos,
       (select count(*) from public.invitaciones) as invitaciones_pendientes
from public.negocios n order by n.id;
