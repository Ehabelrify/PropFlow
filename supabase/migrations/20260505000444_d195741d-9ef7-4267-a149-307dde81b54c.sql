
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.current_tenant() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.current_tenant() to authenticated;
