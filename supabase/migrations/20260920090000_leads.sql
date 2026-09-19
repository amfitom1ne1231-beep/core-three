-- Заявки с сайта. Пишет только серверный роут /api/lead секретным ключом.
-- Лимиты длины совпадают с lib/lead.ts: даже если кто-то доберётся
-- до таблицы в обход формы, мусор крупнее этих рамок не ляжет.

create table public.leads (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  contact text not null check (char_length(contact) between 3 and 160),
  task text not null check (char_length(task) between 3 and 4000),
  kind text not null default 'general'
    check (kind in ('general', 'sites', 'ecommerce', 'bots', 'monitoring', 'concepts')),
  page text not null default '/' check (char_length(page) <= 300),
  -- рабочий статус для разбора заявок в панели Supabase
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'done', 'spam'))
);

comment on table public.leads is 'Заявки с сайта CoreThree. Пишет только /api/lead серверным ключом.';

create index leads_created_at_idx on public.leads (created_at desc);

-- RLS включён, политик нет намеренно: публичные ключи не могут
-- ни читать, ни писать. Серверный ключ обходит RLS.
alter table public.leads enable row level security;
revoke all on public.leads from anon, authenticated;
