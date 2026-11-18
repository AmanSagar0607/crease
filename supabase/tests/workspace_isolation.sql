-- Supabase local pgTAP isolation test.
-- Assumptions: the local test database has the imported legacy schema (projects,
-- events), this migration applied, pgTAP installed, and the Supabase `authenticated`
-- role plus native Clerk-compatible auth.jwt() helper available. Run with `supabase test
-- db`. Fixtures use unique test-only IDs inside a transaction and are rolled back;
-- no production connection or production data is used.
begin;
select plan(12);

-- Fixture setup runs as the local database test owner before switching to authenticated.
insert into public.workspaces(id, name, created_by) values
  ('test-ws-rls-a', 'RLS test A', 'user_test_clerk_a'),
  ('test-ws-rls-b', 'RLS test B', 'user_test_clerk_b')
on conflict (id) do nothing;
insert into public.workspace_memberships(workspace_id, user_id, role) values
  ('test-ws-rls-a', 'user_test_clerk_a', 'owner'),
  ('test-ws-rls-b', 'user_test_clerk_b', 'owner')
on conflict (workspace_id, user_id) do nothing;

insert into public.projects(id, user_id, name, domain, workspace_id)
values
  ('test-project-rls-a', 'user_test_clerk_a', 'RLS test project A', 'a.test.invalid', 'test-ws-rls-a'),
  ('test-project-rls-b', 'user_test_clerk_b', 'RLS test project B', 'b.test.invalid', 'test-ws-rls-b')
on conflict (id) do nothing;
insert into public.events(project_id, id, name, occurred_at, path, visitor_id, session_id, country, device, referrer, properties)
values
  ('test-project-rls-a', 'test-event-rls-a', 'test_a', '2026-01-01T00:00:00Z', '/', null, null, null, null, null, '{}'),
  ('test-project-rls-b', 'test-event-rls-b', 'test_b', '2026-01-01T00:00:00Z', '/', null, null, null, null, null, '{}')
on conflict (project_id, id) do nothing;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_test_clerk_a","role":"authenticated"}', true);
select is((select count(*)::int from public.workspaces where id = 'test-ws-rls-a'), 1, 'identity A sees own workspace');
select is((select count(*)::int from public.projects where id = 'test-project-rls-a'), 1, 'identity A sees own project');
select is((select count(*)::int from public.projects where id = 'test-project-rls-b'), 0, 'identity A cannot read B project');
select is((select count(*)::int from public.events where id = 'test-event-rls-a'), 1, 'identity A sees related event');
select is((select count(*)::int from public.events where id = 'test-event-rls-b'), 0, 'identity A cannot read B event');
select is((with changed as (update public.projects set name = 'stolen' where id = 'test-project-rls-b' returning 1) select count(*)::int from changed), 0, 'identity A cannot update B project');
select is((with removed as (delete from public.projects where id = 'test-project-rls-b' returning 1) select count(*)::int from removed), 0, 'identity A cannot delete B project');
select is((with changed as (update public.events set name = 'stolen' where project_id = 'test-project-rls-b' and id = 'test-event-rls-b' returning 1) select count(*)::int from changed), 0, 'identity A cannot update B event');
select is((with removed as (delete from public.events where project_id = 'test-project-rls-b' and id = 'test-event-rls-b' returning 1) select count(*)::int from removed), 0, 'identity A cannot delete B event');

select set_config('request.jwt.claims', '{"sub":"user_test_clerk_b","role":"authenticated"}', true);
select is((select count(*)::int from public.projects where id = 'test-project-rls-b'), 1, 'identity B sees own project');
select is((select count(*)::int from public.projects where id = 'test-project-rls-a'), 0, 'identity B cannot read A project');
select is((select count(*)::int from public.events where id = 'test-event-rls-a'), 0, 'identity B cannot read A event');

select * from finish();
rollback;
