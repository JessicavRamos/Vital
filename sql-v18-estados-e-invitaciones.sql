-- =====================================================================
-- DALU Vital · v18 · Estado de cada empresa e invitaciones con celular
--   * negocios.estado: 'activo' | 'pausa' | 'finalizada'
--       - activo:     todo normal.
--       - pausa:      SOLO LECTURA. Sus usuarios entran y consultan, pero la base
--                     no deja crear, cambiar ni borrar nada (citas, clientes, precios…).
--       - finalizada: sin acceso. Al entrar ven por qué (como la "pausada" de antes).
--     La columna "activo" se mantiene sincronizada sola (activo = no finalizada),
--     así todo lo que ya existía sigue funcionando.
--   * Solo DALU cambia el estado.
--   * mi_empresa_estado(): nombre y estado de la empresa de quien entró
--     (aunque esté finalizada), para explicarle en la entrada por qué no tiene acceso.
--   * invitaciones.telefono + invitar_usuario(..., p_telefono): para enviar la
--     invitación por WhatsApp directo a esa persona.
-- Necesita el v17. Va en una transacción: si algo falla, no cambia nada.
-- Se puede ejecutar más de una vez.
-- =====================================================================
begin;

-- 1) Estado de la empresa ------------------------------------------------
alter table public.negocios add column if not exists estado text not null default 'activo';
alter table public.negocios drop constraint if exists negocios_estado_valido;
alter table public.negocios add constraint negocios_estado_valido check (estado in ('activo', 'pausa', 'finalizada'));
-- Las empresas que estaban "pausadas" (sin acceso) quedan como finalizadas.
update public.negocios set estado = 'finalizada' where not activo and estado = 'activo';

-- "activo" y "estado" siempre dicen lo mismo
create or replace function public.sincronizar_estado_negocio()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.estado is null then new.estado := case when new.activo then 'activo' else 'finalizada' end; end if;
    new.activo := new.estado <> 'finalizada';
  elsif new.estado is distinct from old.estado then
    new.activo := new.estado <> 'finalizada';
  elsif new.activo is distinct from old.activo then
    -- Algo viejo cambió solo "activo": se traduce al estado
    new.estado := case when new.activo then 'activo' else 'finalizada' end;
  end if;
  return new;
end $$;
drop trigger if exists trg_estado_negocio on public.negocios;
create trigger trg_estado_negocio before insert or update on public.negocios
  for each row execute function public.sincronizar_estado_negocio();

-- Solo DALU cambia plan, dirección o estado
create or replace function public.proteger_negocio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.es_dalu()
     and (new.plan_id is distinct from old.plan_id or new.slug is distinct from old.slug
          or new.activo is distinct from old.activo or new.estado is distinct from old.estado) then
    raise exception 'Solo DALU puede cambiar el plan, la dirección o el estado de la empresa.';
  end if;
  return new;
end $$;

grant select (estado), update (estado), insert (estado) on public.negocios to authenticated;

-- 2) Pausa = solo lectura --------------------------------------------------
create or replace function public.mi_empresa_en_pausa()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles p join public.negocios n on n.id = p.negocio_id
                 where p.id = auth.uid() and n.estado = 'pausa');
$$;

create or replace function public.bloquear_si_pausa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.es_dalu() and public.mi_empresa_en_pausa() then
    raise exception 'Tu empresa está en pausa: puedes consultar tu información, pero no hacer cambios. Comunícate con DALU para reactivarla.';
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['clientes','mascotas','citas','servicios','servicios_anulados','razas','guias',
                           'tipos_servicio','grupos_recordatorio','sedes','precios_sede','usuarios_sedes',
                           'invitaciones','pendientes_descartados','perfiles','videos','negocios'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_pausa on public.%I', t);
      execute format('create trigger trg_pausa before insert or update or delete on public.%I
                      for each statement execute function public.bloquear_si_pausa()', t);
    end if;
  end loop;
end $$;

-- 3) Nombre y estado de mi empresa (aunque esté finalizada) -----------------
create or replace function public.mi_empresa_estado()
returns table(nombre text, estado text)
language sql stable security definer set search_path = public as $$
  select n.nombre, n.estado from public.perfiles p join public.negocios n on n.id = p.negocio_id
  where p.id = auth.uid();
$$;

-- 4) Invitaciones con celular ---------------------------------------------
alter table public.invitaciones add column if not exists telefono text;

drop function if exists public.invitar_usuario(text, text, bigint, bigint[]);
create or replace function public.invitar_usuario(p_correo text, p_rol text default 'empleado',
  p_negocio_id bigint default null, p_sedes bigint[] default null, p_telefono text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_correo text := lower(trim(p_correo));
  v_tel text := nullif(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), '');
  v_negocio bigint;
  v_usuario uuid;
  v_actual bigint;
  v_max int;
  v_sedes bigint[];
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  v_negocio := case when public.es_dalu() and p_negocio_id is not null then p_negocio_id else public.mi_negocio() end;
  if v_negocio is null then raise exception 'Tu usuario no tiene un negocio asignado.'; end if;
  if not (public.es_dalu() or (public.es_administrador() and v_negocio = public.mi_negocio())) then
    raise exception 'Solo el administrador puede invitar usuarios.';
  end if;
  if coalesce(p_rol, '') not in ('administrador', 'empleado') then raise exception 'Rol no válido.'; end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido.'; end if;
  if v_tel is not null and length(v_tel) not between 10 and 13 then
    raise exception 'Escribe un celular válido (10 dígitos).';
  end if;

  -- Sedes válidas de esa empresa (si no se elige ninguna: la sede principal)
  select array_agg(id order by id) into v_sedes from public.sedes
  where negocio_id = v_negocio and id = any(coalesce(p_sedes, '{}'::bigint[]));
  if v_sedes is null then
    select array[min(id)] into v_sedes from public.sedes where negocio_id = v_negocio;
  end if;

  -- Límite de usuarios del plan (cuentan las cuentas y las invitaciones pendientes)
  select p.max_usuarios into v_max from public.negocios n join public.planes p on p.id = n.plan_id where n.id = v_negocio;
  if (select count(*) from public.perfiles where negocio_id = v_negocio)
     + (select count(*) from public.invitaciones where negocio_id = v_negocio and correo <> v_correo) >= v_max then
    raise exception 'Tu plan permite % usuarios. Para agregar más, cambia de plan con DALU.', v_max;
  end if;

  -- ¿Ya tiene cuenta? Se asigna directo (solo si no pertenece a otra empresa).
  select id into v_usuario from auth.users where lower(email) = v_correo;
  if v_usuario is not null then
    select negocio_id into v_actual from public.perfiles where id = v_usuario;
    if v_actual is not null then
      raise exception 'Ese correo ya tiene acceso a un negocio y no se puede invitar.';
    end if;
    insert into public.perfiles (id, correo, negocio_id, rol) values (v_usuario, v_correo, v_negocio, p_rol)
    on conflict (id) do update set negocio_id = excluded.negocio_id, rol = excluded.rol;
    insert into public.usuarios_sedes (usuario_id, sede_id) select v_usuario, unnest(v_sedes) on conflict do nothing;
    return 'asignado';
  end if;

  if exists (select 1 from public.invitaciones where correo = v_correo and negocio_id <> v_negocio)
     and not public.es_dalu() then
    raise exception 'Ese correo ya tiene una invitación pendiente de otro negocio.';
  end if;
  insert into public.invitaciones (correo, negocio_id, rol, creado_por, sedes, telefono)
  values (v_correo, v_negocio, p_rol, auth.uid(), v_sedes, v_tel)
  on conflict (correo) do update set negocio_id = excluded.negocio_id, rol = excluded.rol,
                                     creado_por = excluded.creado_por, creado_en = now(),
                                     sedes = excluded.sedes, telefono = coalesce(excluded.telefono, public.invitaciones.telefono);
  return 'invitado';
end $$;

-- 5) Permisos de las funciones (igual que en v12–v17) ----------------------
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

commit;
