-- ========================================================
-- CineMate Database Schema & Row Level Security (RLS)
-- ========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Rooms Table
create table if not exists public.rooms (
  id text primary key,
  name text not null,
  host_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone default (now() + interval '24 hours'),
  password_hash text,
  theme text default 'midnight',
  max_participants int default 2,
  movie_title text,
  movie_duration numeric,
  movie_size bigint,
  movie_resolution text
);

-- 2. Room Participants Table
create table if not exists public.room_participants (
  id uuid default gen_random_uuid() primary key,
  room_id text references public.rooms(id) on delete cascade not null,
  participant_id text not null,
  display_name text not null,
  participant_role text not null check (participant_role in ('host', 'guest')),
  is_ready boolean default false,
  camera_on boolean default true,
  mic_on boolean default true,
  mood text default 'Cozy',
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Watchlist Table
create table if not exists public.watchlist (
  id text primary key,
  room_id text,
  title text not null,
  description text,
  genre text,
  duration text,
  rating numeric default 5.0,
  poster_url text,
  added_by text not null,
  watched boolean default false,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Movie Night History & Memories
create table if not exists public.movie_night_history (
  id uuid default gen_random_uuid() primary key,
  room_id text,
  movie_title text not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone default timezone('utc'::text, now()),
  duration_watched numeric default 0,
  total_duration numeric default 0,
  reactions_sent int default 0,
  user_rating numeric default 5.0,
  notes text,
  favorite_moment text
);

-- 5. Chat Messages (Optional persistent chat)
create table if not exists public.chat_messages (
  id text primary key,
  room_id text references public.rooms(id) on delete cascade not null,
  sender_id text not null,
  sender_name text not null,
  message text not null,
  is_system boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on all tables
alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.watchlist enable row level security;
alter table public.movie_night_history enable row level security;
alter table public.chat_messages enable row level security;

-- Permissive public policies for private 2-person room access
create policy "Allow all operations for public rooms" on public.rooms for all using (true) with check (true);
create policy "Allow all operations for participants" on public.room_participants for all using (true) with check (true);
create policy "Allow all operations for watchlist" on public.watchlist for all using (true) with check (true);
create policy "Allow all operations for history" on public.movie_night_history for all using (true) with check (true);
create policy "Allow all operations for chat" on public.chat_messages for all using (true) with check (true);

-- Enable Realtime replication
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.chat_messages;
