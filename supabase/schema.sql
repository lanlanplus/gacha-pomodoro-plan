create table if not exists public.user_app_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_state jsonb not null default '{}'::jsonb,
  weekend_categories jsonb not null default '[]'::jsonb,
  task_history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_states enable row level security;

create policy "Users can read their app state"
  on public.user_app_states
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their app state"
  on public.user_app_states
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their app state"
  on public.user_app_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_app_states_updated_at on public.user_app_states;

create trigger set_user_app_states_updated_at
before update on public.user_app_states
for each row
execute function public.set_updated_at();

create table if not exists public.task_completion_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_name text not null,
  category text not null check (category in ('工作', '健康', '学习', '生活', '创意')),
  completed_at timestamptz not null default now()
);

create index if not exists task_completion_log_user_completed_at_idx
  on public.task_completion_log (user_id, completed_at desc);

alter table public.task_completion_log enable row level security;

create policy "Users can read their task completion log"
  on public.task_completion_log
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their task completion log"
  on public.task_completion_log
  for insert
  with check (auth.uid() = user_id);
