-- =====================================================================
-- DALU Vital · v17 · Más información para tu panel Negocios · DALU
--   * uso_negocios(): además de sedes, usuarios e invitaciones, trae clientes,
--     mascotas, citas y servicios del mes, última actividad y último ingreso.
--     Son solo CONTEOS: DALU sigue sin ver los datos de los clientes de cada empresa.
--   * usuarios_de_negocio(id): los usuarios de una empresa con su último ingreso.
--   Las dos son solo para DALU.
-- Necesita el v16. Va en una transacción: si algo falla, no cambia nada.
-- =====================================================================
begin;

drop function if exists public.uso_negocios();
create function public.uso_negocios()
returns table(negocio_id bigint, sedes int, usuarios int, invitaciones int,
              clientes int, mascotas int, citas_mes int, servicios_mes int,
              ultima_actividad date, ultimo_ingreso timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_mes date := date_trunc('month', now() at time zone 'America/Bogota')::date;
begin
  if not public.es_dalu() then raise exception 'Solo DALU puede ver el uso de las empresas.'; end if;
  return query
  select n.id,
         (select count(*)::int from public.sedes s where s.negocio_id = n.id and s.activo),
         (select count(*)::int from public.perfiles p where p.negocio_id = n.id),
         (select count(*)::int from public.invitaciones i where i.negocio_id = n.id),
         (select count(*)::int from public.clientes c where c.negocio_id = n.id),
         (select count(*)::int from public.mascotas m where m.negocio_id = n.id),
         (select count(*)::int from public.citas c where c.negocio_id = n.id and c.estado <> 'cancelada'
            and (c.fecha_hora at time zone 'America/Bogota')::date >= v_mes),
         (select count(*)::int from public.servicios s where s.negocio_id = n.id and s.fecha >= v_mes),
         (select max(s.fecha) from public.servicios s where s.negocio_id = n.id),
         (select max(u.last_sign_in_at) from auth.users u join public.perfiles p on p.id = u.id where p.negocio_id = n.id)
  from public.negocios n;
end $$;

create or replace function public.usuarios_de_negocio(p_negocio_id bigint)
returns table(id uuid, nombre text, correo text, rol text, creado_en timestamptz, ultimo_ingreso timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_dalu() then raise exception 'Solo DALU puede ver los usuarios de otras empresas.'; end if;
  return query
  select p.id, p.nombre, p.correo, p.rol, p.creado_en, u.last_sign_in_at
  from public.perfiles p left join auth.users u on u.id = p.id
  where p.negocio_id = p_negocio_id
  order by p.rol, p.nombre;
end $$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

commit;

-- Comprobación: las funciones nuevas existen (con tu sesión en la app se ven los datos)
select proname as funcion from pg_proc where proname in ('uso_negocios', 'usuarios_de_negocio') order by 1;
