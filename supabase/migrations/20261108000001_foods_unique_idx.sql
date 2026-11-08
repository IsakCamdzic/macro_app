-- Add non-partial unique index on (source, external_id) to allow PostgREST ON CONFLICT upserting
create unique index if not exists foods_source_external_id_idx on foods (source, external_id);
