-- =====================================================================
-- Pet Garden · v8: roles (administrador / empleado) y pantalla de Usuarios
-- No borra ni cambia datos existentes. Se puede ejecutar más de una vez.
-- IMPORTANTE: revisa en el paso 5 que el correo sea el de TU cuenta de administradora.
-- =====================================================================

-- 1) Perfil de cada persona que usa el sistema
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  correo text,
  nombre text,
  rol text not null default 'empleado' check (rol in ('administrador', 'empleado')),
  creado_en timestamptz not null default now()
);
alter table public.perfiles enable row level security;

-- 2) ¿La persona que inició sesión es administradora?
create or replace function public.es_administrador()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'administrador');
$$;
grant execute on function public.es_administrador() to authenticated;

-- 3) Permisos de la tabla de perfiles:
--    cada quien ve su propio perfil; la administradora ve todos y es la única que cambia roles.
drop policy if exists "perfiles_ver" on public.perfiles;
create policy "perfiles_ver" on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_administrador());
drop policy if exists "perfiles_cambiar_rol" on public.perfiles;
create policy "perfiles_cambiar_rol" on public.perfiles for update to authenticated
  using (public.es_administrador()) with check (public.es_administrador());
grant select, update on public.perfiles to authenticated;

-- Siempre debe quedar al menos un administrador
create or replace function public.perfiles_un_admin_minimo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.rol = 'administrador' and new.rol <> 'administrador'
     and not exists (select 1 from public.perfiles where rol = 'administrador' and id <> old.id) then
    raise exception 'Debe quedar al menos un administrador.';
  end if;
  return new;
end $$;
drop trigger if exists trg_perfiles_un_admin on public.perfiles;
create trigger trg_perfiles_un_admin before update of rol on public.perfiles
  for each row execute function public.perfiles_un_admin_minimo();

-- 4) Cada usuario nuevo (creado en Supabase → Authentication) queda como empleado,
--    y su nombre se mantiene al día cuando lo cambia en "Escribe tu nombre".
create or replace function public.crear_perfil_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, correo, nombre)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''))
  on conflict (id) do update set correo = excluded.correo,
                                 nombre = coalesce(excluded.nombre, public.perfiles.nombre);
  return new;
end $$;
drop trigger if exists trg_crear_perfil_usuario on auth.users;
create trigger trg_crear_perfil_usuario after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.crear_perfil_usuario();

-- Perfiles para los usuarios que ya existen (quedan como empleados)
insert into public.perfiles (id, correo, nombre)
select id, email, nullif(trim(raw_user_meta_data ->> 'nombre'), '') from auth.users
on conflict (id) do nothing;

-- 5) TU cuenta queda como administradora (cambia el correo si inicias sesión con otro)
update public.perfiles set rol = 'administrador' where lower(correo) = lower('jessicavramosr@gmail.com');

-- Comprobación: debe salir al menos una fila con rol "administrador"
select correo, nombre, rol from public.perfiles order by rol, correo;

-- 6) Videos: solo la administradora puede borrarlos (de la tabla y del almacenamiento).
--    El empleado puede subir, editar y activar/desactivar.
drop policy if exists "videos_borrar_solo_admin" on public.videos;
create policy "videos_borrar_solo_admin" on public.videos as restrictive for delete to authenticated
  using (public.es_administrador());
drop policy if exists "videos_archivos_borrar_solo_admin" on storage.objects;
create policy "videos_archivos_borrar_solo_admin" on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'videos' or public.es_administrador());
