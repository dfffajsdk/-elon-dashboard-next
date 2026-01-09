-- Enable pgvector extension
create extension if not exists vector;

-- Create memory documents table
create table if not exists memory_documents (
    id uuid default gen_random_uuid() primary key,
    type text not null check (type in ('period_summary', 'prediction', 'feedback', 'tweet_pattern')),
    content text not null,
    embedding vector(1024),
    metadata jsonb default '{}',
    created_at timestamp with time zone default now()
);

-- Create index for vector similarity search
create index on memory_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Create index for type filtering
create index on memory_documents (type);

-- Create function for similarity search
create or replace function match_documents (
    query_embedding vector(1024),
    match_threshold float default 0.7,
    match_count int default 5,
    filter_type text default null
)
returns table (
    id uuid,
    type text,
    content text,
    metadata jsonb,
    created_at timestamp with time zone,
    similarity float
)
language plpgsql
as $$
begin
    return query
    select
        md.id,
        md.type,
        md.content,
        md.metadata,
        md.created_at,
        1 - (md.embedding <=> query_embedding) as similarity
    from memory_documents md
    where 
        (filter_type is null or md.type = filter_type)
        and 1 - (md.embedding <=> query_embedding) > match_threshold
    order by md.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- Enable Row Level Security (optional, for public access)
alter table memory_documents enable row level security;

-- Create policy to allow all operations (for server-side use with service key)
create policy "Allow all operations" on memory_documents
    for all
    using (true)
    with check (true);
