-- =====================================================================
-- DALU Vital · v12: cierra las funciones de la base para quien NO ha iniciado sesión
-- Hallazgo de las pruebas de seguridad: algunas funciones nuevas del v11
-- (por ejemplo carpeta_es_mia) se podían llamar sin sesión. No devolvían datos,
-- pero ninguna función debe estar abierta al público.
-- No borra ni cambia datos. Se puede ejecutar más de una vez.
-- =====================================================================
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

-- Comprobación: no debe salir ninguna fila (ninguna función ejecutable sin sesión).
select p.proname as funcion_abierta
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
order by 1;
