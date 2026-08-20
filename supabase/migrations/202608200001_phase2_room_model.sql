begin;
create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  default_units text not null default 'imperial' check (default_units in ('imperial','metric')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  width_um bigint not null check (width_um > 0),
  depth_um bigint not null check (depth_um > 0),
  ceiling_height_um bigint,
  units text not null default 'imperial' check (units in ('imperial','metric')),
  schema_version integer not null default 2,
  assumptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_measurements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  value_um bigint not null check (value_um > 0),
  tolerance_um bigint not null default 0 check (tolerance_um >= 0),
  confidence numeric(4,3) not null default 0.5 check (confidence between 0 and 1),
  source text not null check (source in ('manual','photo_estimate','ar','lidar','imported')),
  verification text not null default 'estimated' check (verification in ('estimated','verified','corrected')),
  device_context jsonb,
  calibration jsonb,
  correction_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_objects (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  kind text not null check (kind in ('furniture','storage','appliance','fixture','opening','obstacle','build')),
  x_um bigint not null default 0,
  y_um bigint not null default 0,
  width_um bigint not null check (width_um > 0),
  depth_um bigint not null check (depth_um > 0),
  rotation_deg numeric(7,3) not null default 0,
  fixed boolean not null default false,
  clearance_um bigint not null default 0 check (clearance_um >= 0),
  source text not null default 'user' check (source in ('user','vision','system','build')),
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_openings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  wall text not null check (wall in ('north','south','east','west')),
  offset_um bigint not null check (offset_um >= 0),
  width_um bigint not null check (width_um > 0),
  kind text not null check (kind in ('door','window','passage')),
  swing text check (swing is null or swing in ('in','out')),
  created_at timestamptz not null default now()
);

create table if not exists public.room_assets (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  mime_type text not null,
  byte_length bigint not null check (byte_length > 0),
  capture_context jsonb,
  encrypted boolean not null default false,
  encryption_metadata jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.planning_proposals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('organize','arrange','build')),
  title text not null,
  summary text not null,
  rationale jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  placements jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  conflicts jsonb not null default '[]'::jsonb,
  requires_verification jsonb not null default '[]'::jsonb,
  status text not null default 'proposed' check (status in ('proposed','accepted','rejected','edited')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.build_plans (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid references public.planning_proposals(id) on delete set null,
  title text not null,
  geometry jsonb not null,
  materials jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  verification_snapshot jsonb not null default '{}'::jsonb,
  cost_estimate jsonb,
  effort_estimate jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects(owner_id) where deleted_at is null;
create index if not exists rooms_project_idx on public.rooms(project_id);
create index if not exists room_objects_room_idx on public.room_objects(room_id);
create index if not exists room_measurements_room_idx on public.room_measurements(room_id);
create index if not exists room_assets_room_idx on public.room_assets(room_id) where deleted_at is null;

alter table public.projects enable row level security;
alter table public.rooms enable row level security;
alter table public.room_measurements enable row level security;
alter table public.room_objects enable row level security;
alter table public.room_openings enable row level security;
alter table public.room_assets enable row level security;
alter table public.planning_proposals enable row level security;
alter table public.build_plans enable row level security;

create policy "projects_owner_all" on public.projects for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "rooms_owner_all" on public.rooms for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "measurements_owner_all" on public.room_measurements for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "objects_owner_all" on public.room_objects for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "openings_owner_all" on public.room_openings for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "assets_owner_all" on public.room_assets for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "proposals_owner_all" on public.planning_proposals for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "build_plans_owner_all" on public.build_plans for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

do $$ begin
  insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
  values ('room-assets','room-assets',false,15728640,array['image/jpeg','image/png','image/webp','image/heic'])
  on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
exception when undefined_table then null; end $$;

drop policy if exists "room_assets_select" on storage.objects;
drop policy if exists "room_assets_insert" on storage.objects;
drop policy if exists "room_assets_update" on storage.objects;
drop policy if exists "room_assets_delete" on storage.objects;
create policy "room_assets_select" on storage.objects for select to authenticated using (bucket_id='room-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "room_assets_insert" on storage.objects for insert to authenticated with check (bucket_id='room-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "room_assets_update" on storage.objects for update to authenticated using (bucket_id='room-assets' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='room-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "room_assets_delete" on storage.objects for delete to authenticated using (bucket_id='room-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);

commit;
