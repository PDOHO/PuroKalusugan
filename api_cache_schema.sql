-- Create api_cache table for caching stats endpoints
CREATE TABLE IF NOT EXISTS api_cache (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

-- Allow public access
DROP POLICY IF EXISTS "Allow public read access to api_cache" ON api_cache;
DROP POLICY IF EXISTS "Allow public insert access to api_cache" ON api_cache;
DROP POLICY IF EXISTS "Allow public update access to api_cache" ON api_cache;
DROP POLICY IF EXISTS "Allow public delete access to api_cache" ON api_cache;
DROP POLICY IF EXISTS "Allow public all access to api_cache" ON api_cache;

CREATE POLICY "Allow public all access to api_cache" ON api_cache FOR ALL USING (true) WITH CHECK (true);
