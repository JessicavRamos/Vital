-- =====================================================================
-- Pet Garden · v7: el servicio guarda la FECHA DE LA CITA (no el día en que se presionó "Terminar")
-- Pégalo en Supabase → SQL Editor. Se puede ejecutar por partes, en orden.
-- =====================================================================

-- PASO 1 · Copia de seguridad de los servicios tal como están hoy (por si acaso)
create table if not exists public.respaldo_servicios_v7 as table public.servicios;

-- PASO 2 · (Solo para mirar) qué servicios cambiarían de fecha. No cambia nada.
select m.nombre as mascota, s.fecha as fecha_guardada,
       (c.fecha_hora at time zone 'America/Bogota')::date as fecha_de_la_cita
from public.servicios s
join public.citas c on c.id = s.cita_id
join public.mascotas m on m.id = s.mascota_id
where s.fecha <> (c.fecha_hora at time zone 'America/Bogota')::date
order by fecha_de_la_cita;

-- PASO 3 · Desde ahora, al terminar una cita el servicio toma la fecha de la cita
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
            coalesce((new.fecha_hora at time zone 'America/Bogota')::date,
                     (now() at time zone 'America/Bogota')::date),   -- el día de la cita
            coalesce(new.precio_cobrado, new.precio_acordado), new.notas_servicio,
            new.medicado, case when new.medicado then new.recargo_medicado end);
  end if;
  return null;
end $function$;

-- PASO 4 · Corregir los servicios que ya están guardados: toman la fecha de su cita
update public.servicios s
set fecha = (c.fecha_hora at time zone 'America/Bogota')::date
from public.citas c
where c.id = s.cita_id
  and s.fecha <> (c.fecha_hora at time zone 'America/Bogota')::date;
