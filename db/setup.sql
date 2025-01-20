-- Step 1: Enable the pgvector extension (if not already enabled)
create extension if not exists vector;

-- Step 2: Create the documents table
create table if not exists documents (
    id bigserial primary key,
    content text,
    metadata jsonb,
    embedding vector(1536)
);

-- Step 3: Create the similarity search function
create or replace function match_documents (
    query_embedding vector(1536),
    match_count int DEFAULT null,
    filter jsonb DEFAULT '{}'
)
returns table (
    id bigint,
    content text,
    metadata jsonb,
    embedding jsonb,
    similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
    return query
    select 
        id,
        content,
        metadata,
        (embedding::text)::jsonb as embedding,
        1 - (documents.embedding <=> query_embedding) as similarity
    from documents
    where metadata @> filter
    order by documents.embedding <=> query_embedding
    limit match_count;
end;
$$;

-- Step 4: Create an index for better performance
create index if not exists documents_embedding_idx
on documents
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
