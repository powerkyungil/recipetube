create extension if not exists pgcrypto;

create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  anonymous_id text null,
  month_key text not null,
  generation_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usage_records_subject_check check (
    user_id is not null or anonymous_id is not null
  )
);

create unique index if not exists usage_records_user_month_idx
  on public.usage_records (user_id, month_key)
  where user_id is not null;

create unique index if not exists usage_records_anon_month_idx
  on public.usage_records (anonymous_id, month_key)
  where anonymous_id is not null;

create table if not exists public.video_cache (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null unique,
  source_url text not null,
  youtube_title text null,
  transcript text null,
  recipe_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  youtube_video_id text not null,
  source_url text not null,
  title text not null,
  recipe_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, youtube_video_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_format check (nickname ~ '^[가-힣a-zA-Z0-9]{2,16}$')
);

alter table public.usage_records enable row level security;
alter table public.video_cache enable row level security;
alter table public.saved_recipes enable row level security;
alter table public.profiles enable row level security;

create policy "Users can read own saved recipes"
  on public.saved_recipes for select
  using (auth.uid() = user_id);

create policy "Users can delete own saved recipes"
  on public.saved_recipes for delete
  using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can read own profile'
  ) then
    create policy "Users can read own profile"
      on public.profiles for select
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end;
$$;
