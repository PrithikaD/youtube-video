-- Atelier layout persistence contract.
-- Run this in Supabase SQL editor, or as a migration.

alter table public.boards
  add column if not exists atelier_view_mode text not null default 'minimal',
  add column if not exists atelier_groups jsonb not null default '[]'::jsonb,
  add column if not exists atelier_connectors jsonb not null default '[]'::jsonb;

alter table public.boards
  drop constraint if exists boards_atelier_view_mode_check;

alter table public.boards
  add constraint boards_atelier_view_mode_check
  check (atelier_view_mode in ('minimal', 'dense'));

alter table public.cards
  add column if not exists atelier_x double precision not null default 0,
  add column if not exists atelier_y double precision not null default 0,
  add column if not exists atelier_z integer not null default 0;

create index if not exists cards_board_id_atelier_z_idx
  on public.cards (board_id, atelier_z desc);
