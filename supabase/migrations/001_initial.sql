-- ═══════════════════════════════════════════════════════════
-- Word Hunt — Supabase Migration
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  elo         integer not null default 1200,
  wins        integer not null default 0,
  losses      integer not null default 0,
  win_streak  integer not null default 0,
  best_score  integer not null default 0,
  total_games integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at();

-- ─── Games ───────────────────────────────────────────────────────────────────
create table if not exists games (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid not null references profiles(id) on delete cascade,
  opponent_id     uuid references profiles(id) on delete set null,
  mode            text not null check (mode in ('solo', 'pvp', 'private')),
  score           integer not null default 0,
  opponent_score  integer,
  max_possible    integer not null default 0,
  words_found     text[] not null default '{}',
  elo_before      integer not null,
  elo_after       integer not null,
  board           text[] not null default '{}',
  won             boolean,
  created_at      timestamptz not null default now()
);

-- Indexes for fast queries
create index if not exists games_player_id_idx on games(player_id);
create index if not exists games_created_at_idx on games(created_at desc);
create index if not exists profiles_elo_idx on profiles(elo desc);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table games enable row level security;

-- Profiles: anyone can read, only owner can write
create policy "Profiles are publicly readable"
  on profiles for select using (true);

create policy "Users can insert their own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Games: anyone can read, server (service role) writes
create policy "Games are publicly readable"
  on games for select using (true);

-- Service role bypasses RLS, so no INSERT policy needed for server
-- If using anon key on server, add:
-- create policy "Server can insert games"
--   on games for insert with check (true);

-- ─── Helper view: leaderboard ─────────────────────────────────────────────────
create or replace view leaderboard as
  select
    id, username, elo, wins, losses, win_streak, best_score, total_games,
    rank() over (order by elo desc) as rank_position
  from profiles
  order by elo desc;
