-- ============================================================================
-- Gasti — seed.sql (opcional / referencia)
-- Las categorías predeterminadas se siembran AUTOMÁTICAMENTE al registrarse
-- (trigger on_auth_user_created -> seed_default_categories).
--
-- Usa este script solo si necesitas sembrar categorías para usuarios que ya
-- existían ANTES de crear los triggers de la migración 0003.
-- ============================================================================

-- Sembrar categorías predeterminadas para TODOS los usuarios existentes
-- que aún no tengan categorías.
do $$
declare
  u record;
begin
  for u in
    select id from auth.users
    where id not in (select distinct user_id from public.categories)
  loop
    perform public.seed_default_categories(u.id);
  end loop;
end $$;
