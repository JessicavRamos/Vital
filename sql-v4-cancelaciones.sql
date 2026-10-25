-- =====================================================================
-- Pet Garden · v4: cancelar en vez de eliminar (con registro de quién, cuándo y por qué)
-- Pégalo completo en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.
-- =====================================================================

-- 0) De la versión anterior (si ya lo ejecutaste, no pasa nada por repetirlo)
create table if not exists public.pendientes_descartados (
  id bigint generated always as identity primary key,
  mascota_id bigint not null references public.mascotas(id) on delete cascade,
  grupo text not null,
  ultima_fecha date not null,
  creado_en timestamptz not null default now(),
  unique (mascota_id, grupo, ultima_fecha)
);
alter table public.pendientes_descartados enable row level security;
drop policy if exists "descartes_autenticados" on public.pendientes_descartados;
create policy "descartes_autenticados" on public.pendientes_descartados
  for all to authenticated using (true) with check (true);
grant all on public.pendientes_descartados to authenticated;
alter table public.videos add column if not exists activo boolean not null default true;

-- 1) Ya no se permite borrar citas ni servicios desde el sitio (quita los permisos de la v3)
drop policy if exists "borrar_citas" on public.citas;
drop policy if exists "borrar_servicios" on public.servicios;
revoke delete on public.citas, public.servicios from authenticated;

-- 2) Quién canceló cada cita, cuándo y por qué
alter table public.citas add column if not exists cancelada_por text;
alter table public.citas add column if not exists cancelada_en timestamptz;
alter table public.citas add column if not exists motivo_cancelacion text;

-- 3) Bitácora de servicios realizados que se cancelaron (copia completa, no se puede editar ni borrar)
create table if not exists public.servicios_anulados (
  id bigint generated always as identity primary key,
  servicio_id bigint not null,
  cita_id bigint,
  mascota_id bigint,
  fecha date,
  servicio text,
  precio_cobrado numeric,
  medicado boolean,
  datos jsonb not null,             -- copia exacta del servicio como estaba
  motivo text not null,
  anulado_por text not null,
  anulado_por_id uuid,
  anulado_en timestamptz not null default now()
);
create index if not exists servicios_anulados_mascota_idx on public.servicios_anulados (mascota_id);
alter table public.servicios_anulados enable row level security;
drop policy if exists "anulados_leer" on public.servicios_anulados;
create policy "anulados_leer" on public.servicios_anulados for select to authenticated using (true);
grant select on public.servicios_anulados to authenticated;
-- (sin permisos de insertar, editar ni borrar: solo las funciones de abajo escriben aquí)

-- 4) Nombre de quien está usando el sistema (el que escribió en "Escribe tu nombre", o su correo)
create or replace function public.usuario_actual()
returns text language sql stable set search_path = public as $$
  select coalesce(nullif(trim(auth.jwt() -> 'user_metadata' ->> 'nombre'), ''),
                  auth.jwt() ->> 'email', 'desconocido');
$$;

-- 5) Cancelar un servicio ya realizado: lo pasa a la bitácora y deja de contar
--    (visitas, dinero, reportes y recordatorios). Si salió de una cita, la cita queda "cancelada".
create or replace function public.anular_servicio(p_servicio_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  s jsonb; c jsonb; v_cita bigint; v_nombre text;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe el motivo de la cancelación.'; end if;

  select to_jsonb(x) into s from servicios x where x.id = p_servicio_id for update;
  if s is null then raise exception 'El servicio no existe o ya fue cancelado.'; end if;

  v_cita := nullif(s ->> 'cita_id', '')::bigint;
  if v_cita is not null then select to_jsonb(x) into c from citas x where x.id = v_cita; end if;
  select nombre into v_nombre from tipos_servicio where id = nullif(s ->> 'tipo_id', '')::bigint;

  insert into servicios_anulados
    (servicio_id, cita_id, mascota_id, fecha, servicio, precio_cobrado, medicado, datos, motivo, anulado_por, anulado_por_id)
  values
    (p_servicio_id, v_cita,
     coalesce(nullif(s ->> 'mascota_id', '')::bigint, nullif(c ->> 'mascota_id', '')::bigint),
     nullif(s ->> 'fecha', '')::date, v_nombre, nullif(s ->> 'precio_cobrado', '')::numeric,
     coalesce((s ->> 'medicado')::boolean, false), s, trim(p_motivo), usuario_actual(), auth.uid());

  delete from servicios where id = p_servicio_id;

  if v_cita is not null then
    update citas set estado = 'cancelada', cancelada_por = usuario_actual(),
                     cancelada_en = now(), motivo_cancelacion = trim(p_motivo)
    where id = v_cita;
  end if;
end $$;

-- 6) Cancelar una cita en cualquier momento (pendiente o ya realizada)
create or replace function public.cancelar_cita(p_cita_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_serv bigint;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribe el motivo de la cancelación.'; end if;

  select id into v_serv from servicios where cita_id = p_cita_id limit 1;
  if v_serv is not null then
    perform anular_servicio(v_serv, p_motivo);   -- también marca la cita como cancelada
  else
    update citas set estado = 'cancelada', cancelada_por = usuario_actual(),
                     cancelada_en = now(), motivo_cancelacion = trim(p_motivo)
    where id = p_cita_id and estado <> 'cancelada';
    if not found then raise exception 'La cita no existe o ya estaba cancelada.'; end if;
  end if;
end $$;

revoke all on function public.anular_servicio(bigint, text) from public, anon;
revoke all on function public.cancelar_cita(bigint, text) from public, anon;
grant execute on function public.anular_servicio(bigint, text) to authenticated;
grant execute on function public.cancelar_cita(bigint, text) to authenticated;
grant execute on function public.usuario_actual() to authenticated;
