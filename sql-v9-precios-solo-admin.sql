-- =====================================================================
-- Pet Garden · v9: solo el administrador cambia razas y precios; nuevo administrador
-- No borra ni cambia datos existentes. Se puede ejecutar más de una vez.
-- (Necesita que el SQL de roles v8 ya esté ejecutado.)
-- =====================================================================

-- 1) Razas y precios: todos pueden VER; solo el administrador puede agregar, cambiar o quitar
drop policy if exists "razas_agregar_solo_admin" on public.razas;
create policy "razas_agregar_solo_admin" on public.razas as restrictive for insert to authenticated
  with check (public.es_administrador());
drop policy if exists "razas_cambiar_solo_admin" on public.razas;
create policy "razas_cambiar_solo_admin" on public.razas as restrictive for update to authenticated
  using (public.es_administrador()) with check (public.es_administrador());
drop policy if exists "razas_quitar_solo_admin" on public.razas;
create policy "razas_quitar_solo_admin" on public.razas as restrictive for delete to authenticated
  using (public.es_administrador());

-- 2) Nuevo administrador
update public.perfiles set rol = 'administrador' where lower(correo) = lower('cyhernandezc@gmail.com');

-- Comprobación: cyhernandezc@gmail.com debe salir como "administrador".
-- Si NO aparece en la lista, primero créalo en Supabase → Authentication → Users → Add user
-- y vuelve a ejecutar este SQL (o cámbiale el rol en la pantalla Usuarios).
select correo, nombre, rol from public.perfiles order by rol, correo;
