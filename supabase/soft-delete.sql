-- Soft-delete support for boards/cards with 7-day retention.
-- Run this in the Supabase SQL editor.

alter table public.boards
  add column if not exists deleted_at timestamptz;

alter table public.cards
  add column if not exists deleted_at timestamptz;

create index if not exists boards_deleted_at_idx
  on public.boards (deleted_at);

create index if not exists cards_deleted_at_idx
  on public.cards (deleted_at);

create or replace function public.purge_soft_deleted_content()
returns void
language plpgsql
as $$
begin
  delete from public.cards
  where deleted_at is not null
    and deleted_at <= now() - interval '7 days';

  delete from public.boards
  where deleted_at is not null
    and deleted_at <= now() - interval '7 days';
end;
$$;

-- If pg_cron is enabled, schedule daily purge at 03:00 UTC:
-- select cron.schedule(
--   'purge-soft-deleted',
--   '0 3 * * *',
--   $$call public.purge_soft_deleted_content();$$
-- );
