-- =====================================================================
-- DALU Vital · v16 · Suscripción que muestra el valor, no el gasto
--   * El plan Básico pasa a llamarse "Esencial" (los nombres se editan en tu panel).
--   * resumen_mes(): lo que la empresa logró este mes con DALU Vital
--     (citas, servicios, mascotas atendidas, nuevas y que regresaron).
--     Usa los permisos de quien la llama: cada empresa solo cuenta lo suyo.
--   * mi_suscripcion() también trae "cliente desde".
-- Necesita el v14. Va en una transacción: si algo falla, no cambia nada.
-- =====================================================================
begin;

update public.planes set nombre = 'Esencial' where id = 'basico' and nombre = 'Básico';

create or replace function public.resumen_mes(p_desde date default null)
returns table (citas_agendadas bigint, servicios bigint, mascotas_atendidas bigint,
               mascotas_nuevas bigint, mascotas_regresaron bigint)
language sql stable security invoker set search_path = public as $$
  with r as (
    select coalesce(p_desde, date_trunc('month', (now() at time zone 'America/Bogota'))::date) as desde
  ), r2 as (select desde, (desde + interval '1 month')::date as hasta from r),
  mes as (
    select s.mascota_id from public.servicios s, r2 where s.fecha >= r2.desde and s.fecha < r2.hasta
  ),
  atendidas as (select distinct mascota_id from mes),
  antes as (
    select distinct s.mascota_id from public.servicios s, r2
    where s.fecha < r2.desde and s.mascota_id in (select mascota_id from atendidas)
  )
  select
    (select count(*) from public.citas c, r2
      where c.estado <> 'cancelada'
        and (c.fecha_hora at time zone 'America/Bogota')::date >= r2.desde
        and (c.fecha_hora at time zone 'America/Bogota')::date < r2.hasta),
    (select count(*) from mes),
    (select count(*) from atendidas),
    (select count(*) from atendidas where mascota_id not in (select mascota_id from antes)),
    (select count(*) from antes);
$$;

drop function if exists public.mi_suscripcion();
create function public.mi_suscripcion()
returns table (plan text, precio_mensual numeric, ultimo_pago date, proximo_pago date, cliente_desde date)
language sql stable security definer set search_path = public as $$
  select pl.nombre, pl.precio_mensual, ul.fecha, ul.proximo_pago,
         (n.creado_en at time zone 'America/Bogota')::date
  from public.negocios n
  left join public.planes pl on pl.id = n.plan_id
  left join lateral (
    select p.fecha, p.proximo_pago from public.pagos p
    where p.negocio_id = n.id order by p.fecha desc, p.id desc limit 1
  ) ul on true
  where n.id = public.mi_negocio() and public.es_administrador();
$$;

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

commit;

-- Comprobación: los planes con su nombre nuevo
select id, nombre, precio_mensual, max_sedes, max_usuarios from public.planes order by orden;
