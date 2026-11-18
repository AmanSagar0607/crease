-- Zappa workspace tenancy and Clerk-native Supabase RLS scaffold.
-- Assumptions: apply after importing the legacy PostgreSQL schema (Alembic 0001-0005
-- where available). Existing users.id/projects.user_id are legacy TEXT/VARCHAR owner
-- identifiers and are NOT assumed to equal Clerk subjects. No rows are moved or
-- deleted. Historical owners must be explicitly and securely mapped in user_profiles
-- before their Clerk sessions can access existing projects. Optional tables are
-- protected only when present. This file is additive.
-- Clerk must be enabled as Supabase's native Third-Party Provider; do not use JWT
-- templates or create Supabase Auth users. RLS principal: auth.jwt()->>'sub'.

begin;

create table if not exists public.workspaces (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists public.workspace_memberships (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner', 'admin', 'member', 'analyst')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_memberships_user_idx
  on public.workspace_memberships(user_id, workspace_id);

-- Mapping for any later import where old owner IDs differ from Clerk subjects.
-- Both identifiers are text: legacy IDs are not assumed to be UUIDs.
create table if not exists public.user_profiles (
  clerk_user_id text primary key,
  legacy_user_id text unique,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Legacy projects are grouped by their existing owner. Deterministic workspace IDs
-- make retries safe and leave project IDs, ownership fields, and analytics untouched.
do $$
declare
  project_owner text;
  workspace_key text;
begin
  if to_regclass('public.projects') is null then
    raise exception 'public.projects is required; import the existing schema before applying Zappa RLS';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='projects' and column_name='user_id'
  ) then
    raise exception 'public.projects.user_id is required for the non-destructive owner-based backfill';
  end if;

  alter table public.projects add column if not exists workspace_id text;

  for project_owner in execute 'select distinct user_id::text from public.projects where user_id is not null order by user_id::text' loop
    workspace_key := 'legacy-owner-' || md5(project_owner);
    insert into public.workspaces(id, name, created_by)
      values (workspace_key, 'Workspace', project_owner)
      on conflict (id) do nothing;
    insert into public.workspace_memberships(workspace_id, user_id, role)
      values (workspace_key, project_owner, 'owner')
      on conflict (workspace_id, user_id) do nothing;
    execute 'update public.projects set workspace_id = $1 where user_id::text = $2 and workspace_id is null'
      using workspace_key, project_owner;
  end loop;
end $$;

create index if not exists projects_workspace_idx on public.projects(workspace_id);

-- SECURITY DEFINER helpers avoid membership-policy recursion. Fixed search_path and
-- schema-qualified objects prevent object-shadowing. No public execute privileges.
create or replace function public.current_clerk_user_id()
returns text
language sql stable
security invoker
set search_path = pg_catalog
as $$ select nullif(auth.jwt() ->> 'sub', '') $$;

create or replace function public.is_workspace_member(target_workspace_id text)
returns boolean
language sql stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.workspace_memberships m
    where m.workspace_id = target_workspace_id
      and (
        m.user_id = public.current_clerk_user_id()
        or m.user_id = (select p.legacy_user_id from public.user_profiles p
                        where p.clerk_user_id = public.current_clerk_user_id())
      )
  )
$$;

create or replace function public.has_workspace_role(target_workspace_id text, allowed_roles text[])
returns boolean
language sql stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.workspace_memberships m
    where m.workspace_id = target_workspace_id
      and (
        m.user_id = public.current_clerk_user_id()
        or m.user_id = (select p.legacy_user_id from public.user_profiles p
                        where p.clerk_user_id = public.current_clerk_user_id())
      )
      and m.role = any (allowed_roles)
  )
$$;

create or replace function public.can_access_project(target_project_id text)
returns boolean
language sql stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.projects p
    where p.id::text = target_project_id
      and p.workspace_id is not null
      and public.is_workspace_member(p.workspace_id)
  )
$$;

create or replace function public.can_manage_project(target_project_id text)
returns boolean
language sql stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.projects p
    where p.id::text = target_project_id
      and p.workspace_id is not null
      and public.has_workspace_role(p.workspace_id, array['owner','admin']::text[])
  )
$$;

revoke all on function public.is_workspace_member(text) from public, anon;
revoke all on function public.has_workspace_role(text, text[]) from public, anon;
revoke all on function public.can_access_project(text) from public, anon;
revoke all on function public.can_manage_project(text) from public, anon;
grant execute on function public.is_workspace_member(text) to authenticated;
grant execute on function public.has_workspace_role(text, text[]) to authenticated;
grant execute on function public.can_access_project(text) to authenticated;
grant execute on function public.can_manage_project(text) to authenticated;

-- Enable and force RLS so table owners used by ordinary application connections do
-- not accidentally bypass the isolation boundary. Supabase service_role remains an
-- explicitly privileged server-only path and must never be exposed in browser code.
create or replace function public._zappa_enable_rls(target_table text)
returns void language plpgsql security invoker set search_path = pg_catalog as $$
begin
  execute format('alter table public.%I enable row level security', target_table);
  execute format('alter table public.%I force row level security', target_table);
end $$;

select public._zappa_enable_rls('workspaces');
select public._zappa_enable_rls('workspace_memberships');
select public._zappa_enable_rls('user_profiles');
select public._zappa_enable_rls('projects');

drop policy if exists workspace_member_read on public.workspaces;
create policy workspace_member_read on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

drop policy if exists membership_member_read on public.workspace_memberships;
create policy membership_member_read on public.workspace_memberships for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists profile_self_read on public.user_profiles;
create policy profile_self_read on public.user_profiles for select to authenticated
  using (clerk_user_id = public.current_clerk_user_id());

drop policy if exists projects_workspace_read on public.projects;
create policy projects_workspace_read on public.projects for select to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id));
drop policy if exists projects_admin_insert on public.projects;
create policy projects_admin_insert on public.projects for insert to authenticated
  with check (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin']::text[]));
drop policy if exists projects_admin_update on public.projects;
create policy projects_admin_update on public.projects for update to authenticated
  using (public.can_manage_project(id::text))
  with check (workspace_id is not null and public.has_workspace_role(workspace_id, array['owner','admin']::text[]));
drop policy if exists projects_admin_delete on public.projects;
create policy projects_admin_delete on public.projects for delete to authenticated
  using (public.can_manage_project(id::text));

-- Apply workspace membership reads and project-scoped reads to data tables. Analytics
-- are read-only to Clerk clients; ingestion/retention uses trusted server-side paths.
-- Project and integration mutations are owner/admin only. Payment webhook event rows
-- are reached through their integration's project. RLS remains fail-closed when the
-- Clerk subject has no membership or a row has no matching project.
do $$
declare
  rel text;
begin
  foreach rel in array array[
    'events','analytics_sessions','event_properties','project_property_keys',
    'attribution_touchpoints','project_goals','payments',
    'project_repositories','project_vercel','payment_integrations'
  ] loop
    if to_regclass('public.' || rel) is not null then
      perform public._zappa_enable_rls(rel);
      execute format('drop policy if exists %I on public.%I', rel || '_member_read', rel);
      execute format('create policy %I on public.%I for select to authenticated using (public.can_access_project(project_id::text))', rel || '_member_read', rel);
      if rel in ('project_repositories','project_vercel','payment_integrations') then
        execute format('drop policy if exists %I on public.%I', rel || '_admin_insert', rel);
        execute format('create policy %I on public.%I for insert to authenticated with check (public.can_manage_project(project_id::text))', rel || '_admin_insert', rel);
        execute format('drop policy if exists %I on public.%I', rel || '_admin_update', rel);
        execute format('create policy %I on public.%I for update to authenticated using (public.can_manage_project(project_id::text)) with check (public.can_manage_project(project_id::text))', rel || '_admin_update', rel);
        execute format('drop policy if exists %I on public.%I', rel || '_admin_delete', rel);
        execute format('create policy %I on public.%I for delete to authenticated using (public.can_manage_project(project_id::text))', rel || '_admin_delete', rel);
      end if;
    end if;
  end loop;

  if to_regclass('public.payment_webhook_events') is not null
     and to_regclass('public.payment_integrations') is not null then
    perform public._zappa_enable_rls('payment_webhook_events');
    execute 'drop policy if exists payment_webhook_events_member_read on public.payment_webhook_events';
    execute $policy$create policy payment_webhook_events_member_read on public.payment_webhook_events
      for select to authenticated using (exists (
        select 1 from public.payment_integrations i
        where i.id = payment_webhook_events.integration_id
          and public.can_access_project(i.project_id::text)
      ))$policy$;
  end if;
end $$;

-- Identity/session and operational tables are not part of browser-exposed customer
-- data; do not grant direct API access to their contents. No Supabase Auth user/profile
-- is created here. Tables users/sessions/oauth_states remain for legacy backend code.
revoke all on public.workspaces, public.workspace_memberships, public.user_profiles from anon;
grant select on public.workspaces, public.workspace_memberships to authenticated;
-- Profile-to-legacy-ID mappings are trusted synchronization metadata and are
-- intentionally read-only to end-user JWTs to prevent account-claiming attempts.
grant select on public.user_profiles to authenticated;
grant select on public.projects to authenticated;
grant insert, update, delete on public.projects to authenticated;

-- Internal setup helper is removed after schema policies are installed.
drop function public._zappa_enable_rls(text);

commit;
