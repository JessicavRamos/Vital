const SUPABASE_URL = "https://hkzaxvijtomwhzmvyqkq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3ljuZK8TC8p2gPDqMRR5Ow_irEkQdcZ";
// Negocio que se muestra sin sesión cuando la dirección no trae ?negocio=... (entrada y videos públicos).
// El nombre y el logo de cada negocio vienen de la base de datos (tabla "negocios").
const NEGOCIO_POR_DEFECTO = "petgarden";
// Solo se usa si la base todavía no tiene el SQL v11 (un solo negocio).
const NOMBRE_NEGOCIO = "Pet Garden";