-- Create public circuits bucket for storing large ZK circuit files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('circuits', 'circuits', true);

-- Allow public read access to circuit files
CREATE POLICY "Public can read circuit files"
ON storage.objects FOR SELECT
USING (bucket_id = 'circuits');