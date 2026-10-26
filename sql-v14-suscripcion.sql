-- =====================================================================
-- DALU Vital · v14 · Suscripción sin historial para el cliente
--   * Cada plan tiene su precio mensual (lo editas en Negocios · DALU → Planes).
--   * Cada pago guarda la fecha del PRÓXIMO pago (ej. el 4 de cada mes).
--   * El administrador de cada empresa ya NO puede leer la tabla de pagos
--     (ni valores pasados ni sumas): solo ve, con mi_suscripcion(),
--     la fecha del último pago, la del próximo y el valor de su plan.
-- Necesita el v13. Va en una transacción: si algo falla, no cambia nada.
-- =====================================================================
begin;

-- 1) Precio mensual de cada plan -----------------------------------------
alter table public.planes add column if not exists precio_mensual numeric not null default 0;
alter table public.planes drop constraint if exists planes_precio_ok;
alter table public.planes add constraint planes_precio_ok check (precio_mensual >= 0);

-- 2) Próximo pago en cada pago -------------------------------------------
alter table public.pagos add column if not exists proximo_pago date;
update public.pagos set proximo_pago = (fecha + interval '1 month')::date where proximo_pago is null;
alter table public.pagos alter column proximo_pago set not null;
alter table public.pagos drop constraint if exists pagos_proximo_ok;
alter table public.pagos add constraint pagos_proximo_ok check (proximo_pago > fecha);

-- 3) Solo DALU lee la tabla de pagos ----------------------------------------
drop policy if exists "pagos_ver" on public.pagos;
create policy "pagos_ver" on public.pagos for select to authenticated using (public.es_dalu());

-- 4) Lo que ve el administrador: sin valores pasados ni sumas -------------
create or replace function public.mi_suscripcion()
returns table (plan text, precio_mensual numeric, ultimo_pago date, proximo_pago date)
language sql stable security definer set search_path = public as $$
  select pl.nombre, pl.precio_mensual, ul.fecha, ul.proximo_pago
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

-- Comprobación: tu empresa con su próximo pago (el precio empieza en 0: ponlo en Planes)
select n.nombre as empresa, pl.nombre as plan, pl.precio_mensual,
       (select max(p.fecha) from public.pagos p where p.negocio_id = n.id) as ultimo_pago,
       (select p.proximo_pago from public.pagos p where p.negocio_id = n.id order by p.fecha desc, p.id desc limit 1) as proximo_pago,
       has_table_privilege('anon', 'public.pagos', 'select') as anon_puede_ver_pagos
from public.negocios n left join public.planes pl on pl.id = n.plan_id order by n.id;
