-- =====================================================================
-- DALU Vital · v15 · Ajustes después de probar con datos reales
-- 1) Las sedes solo se ven dentro de su empresa. Antes, la cuenta DALU podía VER
--    (no cambiar) los nombres de las sedes de otras empresas y a qué sede estaba
--    asignado cada usuario. Ahora DALU solo ve cuántas sedes usa cada empresa.
-- 2) Mientras Pet Garden siga en la versión anterior (main), los precios que se
--    cambien en su Catálogos (tabla razas) pasan solos a los precios de la sede,
--    y una raza nueva queda en todas las sedes. Así no hay que esperar para editar precios.
-- =====================================================================
begin;

drop policy if exists "sedes_ver" on public.sedes;
create policy "sedes_ver" on public.sedes for select to authenticated
  using (negocio_id = (select public.mi_negocio()));

drop policy if exists "usuarios_sedes_ver" on public.usuarios_sedes;
create policy "usuarios_sedes_ver" on public.usuarios_sedes for select to authenticated
  using (usuario_id = auth.uid() or (public.es_administrador() and public.sede_de_mi_negocio(sede_id)));

-- 2) Precios de la versión anterior → precios de la sede
create or replace function public.razas_a_precios_sede()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Raza nueva: queda en todas las sedes de su empresa (con los precios que traiga)
    insert into public.precios_sede (negocio_id, sede_id, raza_id, precio_bano, precio_corte, precio_corte_bano, precio_unas, recargo_medicado)
    select new.negocio_id, s.id, new.id, new.precio_bano, new.precio_corte, new.precio_corte_bano, new.precio_unas, new.recargo_medicado
    from public.sedes s where s.negocio_id = new.negocio_id
    on conflict do nothing;
  elsif (select count(*) from public.sedes s where s.negocio_id = new.negocio_id) = 1 then
    -- Cambio de precio en la versión anterior (solo tiene sentido con una sede)
    update public.precios_sede set precio_bano = new.precio_bano, precio_corte = new.precio_corte,
           precio_corte_bano = new.precio_corte_bano, precio_unas = new.precio_unas, recargo_medicado = new.recargo_medicado
    where raza_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists trg_razas_a_precios_sede on public.razas;
create trigger trg_razas_a_precios_sede after insert or update of precio_bano, precio_corte, precio_corte_bano, precio_unas, recargo_medicado
  on public.razas for each row execute function public.razas_a_precios_sede();

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

commit;

-- Comprobación: las reglas nuevas
select tablename, policyname, qual from pg_policies
where tablename in ('sedes', 'usuarios_sedes') and cmd = 'SELECT' order by 1;
