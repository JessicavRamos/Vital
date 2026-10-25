-- =====================================================================
-- Pet Garden · v5: permitir CANCELAR una cita realizada (sin permitir "reabrirla")
-- Solo cambia la regla del disparador; no toca ningún dato.
-- Pégalo en Supabase → SQL Editor → Run.
-- =====================================================================
create or replace function public.crear_servicio_al_completar()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'UPDATE' then
    if old.estado = 'realizada' and new.estado <> 'realizada' then
      -- Se permite pasar a "cancelada" solo si su servicio ya se pasó a la bitácora de cancelados
      -- (eso lo hacen las funciones cancelar_cita / anular_servicio, que registran quién, cuándo y por qué).
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
