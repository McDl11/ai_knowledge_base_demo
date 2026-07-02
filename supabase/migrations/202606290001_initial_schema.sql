create extension if not exists "pgcrypto";
create extension if not exists "vector";

create type knowledge_item_type as enum ('text', 'markdown', 'pdf', 'image', 'video', 'audio');
create type knowledge_item_status as enum ('processing', 'ready', 'failed');
create type chat_message_role as enum ('user', 'assistant');
create type answer_feedback_rating as enum ('helpful', 'not_helpful');

create table knowledge_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type knowledge_item_type not null,
  file_name text not null,
  file_type text not null,
  status knowledge_item_status not null default 'processing',
  chunk_count integer not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references knowledge_items(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  token_count integer not null default 0,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (item_id, chunk_index)
);

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role chat_message_role not null,
  content text not null,
  sources_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table answer_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references chat_messages(id) on delete cascade,
  rating answer_feedback_rating not null,
  created_at timestamptz not null default now(),
  unique (message_id)
);

create index knowledge_items_status_idx on knowledge_items (status);
create index knowledge_chunks_item_id_idx on knowledge_chunks (item_id);
create index chat_messages_session_id_created_at_idx on chat_messages (session_id, created_at);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger knowledge_items_set_updated_at
before update on knowledge_items
for each row execute function set_updated_at();

create trigger chat_sessions_set_updated_at
before update on chat_sessions
for each row execute function set_updated_at();

create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  chunk_id uuid,
  item_id uuid,
  item_title text,
  chunk_index integer,
  content text,
  token_count integer,
  metadata_json jsonb,
  similarity float
)
language sql
stable
as $$
  select
    knowledge_chunks.id as chunk_id,
    knowledge_chunks.item_id,
    knowledge_items.title as item_title,
    knowledge_chunks.chunk_index,
    knowledge_chunks.content,
    knowledge_chunks.token_count,
    knowledge_chunks.metadata_json,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
  from knowledge_chunks
  join knowledge_items on knowledge_items.id = knowledge_chunks.item_id
  where knowledge_items.status = 'ready'
    and 1 - (knowledge_chunks.embedding <=> query_embedding) >= match_threshold
  order by knowledge_chunks.embedding <=> query_embedding
  limit match_count;
$$;
