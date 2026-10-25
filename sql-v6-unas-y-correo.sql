-- =====================================================================
-- Pet Garden · v6: servicio "Uñas" con precio por raza, y nombre + correo en las cancelaciones
-- No borra ni cambia datos existentes. Se puede ejecutar más de una vez.
-- =====================================================================

-- 1) Precio de uñas por raza (nueva columna; las razas quedan con el precio vacío hasta que lo escribas)
alter table public.razas add column if not exists precio_unas numeric;

-- 2) Grupo de recordatorio propio para uñas (así un corte de uñas no reinicia el recordatorio del baño)
insert into public.grupos_recordatorio (nombre, frecuencia_dias)
select 'Uñas', 30
where not exists (select 1 from public.grupos_recordatorio where nombre = 'Uñas');

-- 3) Servicio "Uñas"
insert into public.tipos_servicio (nombre, grupo_id)
select 'Uñas', (select id from public.grupos_recordatorio where nombre = 'Uñas' limit 1)
where not exists (select 1 from public.tipos_servicio where nombre = 'Uñas');

-- 4) Quien cancela queda como "Nombre (correo)". El correo sale de la cuenta con la que inició
--    sesión, así que no se puede cambiar como el nombre del perfil.
create or replace function public.usuario_actual()
returns text language sql stable set search_path = public as $$
  select case
    when nullif(trim(auth.jwt() -> 'user_metadata' ->> 'nombre'), '') is not null and auth.jwt() ->> 'email' is not null
      then trim(auth.jwt() -> 'user_metadata' ->> 'nombre') || ' (' || (auth.jwt() ->> 'email') || ')'
    else coalesce(auth.jwt() ->> 'email', 'desconocido')
  end;
$$;

-- 5) (Repetido de la v5, por si no se ejecutó) permitir cancelar una cita realizada solo por el camino correcto
create or replace function public.crear_servicio_al_completar()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'UPDATE' then
    if old.estado = 'realizada' and new.estado <> 'realizada' then
      if new.estado = 'cancelada' and not exists (select 1 from servicios where cita_id = new.id) then
        return null;
      end if;
      raise exception 'Una cita realizada no se puede reabrir. Corrige el servicio desde el historial.';
    end if;
    if old.estado = 'realizada' then
      return null;
    end if;
  end if;
  if new.estado = 'realizada' then
    if new.tipo_id is null then
      raise exception 'Elige el servicio de la cita antes de marcarla como realizada.';
    end if;
    insert into servicios (mascota_id, tipo_id, guia_id, cita_id, fecha, precio_cobrado, notas,
                           medicado, recargo_medicado)
    values (new.mascota_id, new.tipo_id, new.guia_id, new.id,
            (now() at time zone 'America/Bogota')::date,
            coalesce(new.precio_cobrado, new.precio_acordado), new.notas_servicio,
            new.medicado, case when new.medicado then new.recargo_medicado end);
  end if;
  return null;
end $function$;
