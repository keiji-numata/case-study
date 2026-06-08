create extension if not exists vector;

create table parts (
  id                   uuid primary key default gen_random_uuid(),
  part_number          text unique not null,
  name                 text not null,
  category             text not null,
  description          text,
  price                numeric(10,2),
  image_url            text,
  install_instructions text,
  embedding            vector(512)
);

create table compatibility (
  id           uuid primary key default gen_random_uuid(),
  part_number  text references parts(part_number),
  model_number text not null,
  brand        text,
  constraint compatibility_part_model_unique unique (part_number, model_number)
);

create index on parts using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_parts(
  query_embedding vector(512),
  match_threshold float,
  match_count int,
  filter_category text default null
)
returns table (
  part_number text,
  name text,
  category text,
  description text,
  price numeric,
  image_url text,
  install_instructions text,
  similarity float
)
language sql stable
as $$
  select
    parts.part_number,
    parts.name,
    parts.category,
    parts.description,
    parts.price,
    parts.image_url,
    parts.install_instructions,
    1 - (parts.embedding <=> query_embedding) as similarity
  from parts
  where
    (filter_category is null or parts.category = filter_category)
    and 1 - (parts.embedding <=> query_embedding) > match_threshold
  order by parts.embedding <=> query_embedding
  limit match_count;
$$;