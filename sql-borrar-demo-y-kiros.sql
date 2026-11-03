-- =====================================================================
-- DALU Vital · Borrar las empresas de prueba "Demo" y "Kiros"
-- Borra TODO lo de esas dos empresas: sedes, precios, catálogos, clientes,
-- citas, servicios, invitaciones, pagos, sus usuarios y las cuentas de
-- sus correos (jessicaramos@fymtech.com y kiroscolombia@gmail.com).
-- Pet Garden no se toca: si algo no cuadra, se detiene y no borra nada.
-- ¡No se puede deshacer!
-- =====================================================================
begin;

create temp table borrar on commit drop as
  select id, nombre from public.negocios where slug in ('demo', 'kiros');

do $$
begin
  if exists (select 1 from borrar where id = 1 or nombre ilike '%pet garden%') then
    raise exception 'Alto: Pet Garden no se puede borrar.';
  end if;
  if (select count(*) from borrar) <> 2 then
    raise exception 'Alto: se esperaban 2 empresas (demo y kiros) y hay %.', (select count(*) from borrar);
  end if;
end $$;

-- Correos de sus usuarios e invitaciones (para borrar también sus cuentas)
create temp table correos on commit drop as
  select lower(correo) as correo from public.invitaciones where negocio_id in (select id from borrar)
  union
  select lower(correo) from public.perfiles where negocio_id in (select id from borrar) and correo is not null;

delete from public.usuarios_sedes where sede_id in (select id from public.sedes where negocio_id in (select id from borrar));
delete from public.precios_sede where negocio_id in (select id from borrar);

do $$
declare t text;
begin
  foreach t in array array['servicios_anulados', 'pendientes_descartados', 'servicios', 'citas', 'mascotas', 'clientes',
                           'razas', 'guias', 'tipos_servicio', 'grupos_recordatorio', 'videos', 'invitaciones', 'pagos'] loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I where negocio_id in (select id from borrar)', t);
    end if;
  end loop;
end $$;

-- Usuarios: su perfil y su cuenta (solo si no pertenecen a otra empresa)
delete from public.perfiles where negocio_id in (select id from borrar);
delete from auth.users u
where lower(u.email) in (select correo from correos)
  and not exists (select 1 from public.perfiles p where p.id = u.id);

delete from public.sedes where negocio_id in (select id from borrar);
delete from public.negocios where id in (select id from borrar);

-- Nada debe quedar apuntando a esas empresas (revisa todas las tablas con negocio_id)
do $$
declare r record; n bigint;
begin
  for r in select c.table_name from information_schema.columns c
           join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
           where c.table_schema = 'public' and c.column_name = 'negocio_id' and t.table_type = 'BASE TABLE' loop
    execute format('select count(*) from public.%I where negocio_id not in (select id from public.negocios)', r.table_name) into n;
    if n > 0 then raise exception 'Alto: quedaron % filas sueltas en %.', n, r.table_name; end if;
  end loop;
end $$;

commit;

-- Comprobación: solo debe quedar Pet Garden y ninguna cuenta de esos correos
select n.id, n.nombre, n.slug,
       (select count(*) from auth.users u where lower(u.email) in ('jessicaramos@fymtech.com', 'kiroscolombia@gmail.com')) as cuentas_de_esos_correos,
       (select count(*) from public.invitaciones) as invitaciones_pendientes
from public.negocios n order by n.id;
