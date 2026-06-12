
-- Create a table for election authorities
CREATE TABLE public.election_authorities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  public_key_x TEXT NOT NULL,
  public_key_y TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add a foreign key to elections table to reference the election authority
ALTER TABLE public.elections 
ADD COLUMN authority_id UUID REFERENCES public.election_authorities(id);

-- Create an index for better performance when querying by authority
CREATE INDEX idx_elections_authority_id ON public.elections(authority_id);

-- Add Row Level Security
ALTER TABLE public.election_authorities ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view election authorities (public information)
CREATE POLICY "Allow viewing election authorities" 
  ON public.election_authorities 
  FOR SELECT 
  USING (true);

-- Only allow inserting election authorities (admin functionality)
CREATE POLICY "Allow creating election authorities" 
  ON public.election_authorities 
  FOR INSERT 
  WITH CHECK (true);

-- Allow updating election authorities
CREATE POLICY "Allow updating election authorities" 
  ON public.election_authorities 
  FOR UPDATE 
  USING (true);

-- Allow deleting election authorities
CREATE POLICY "Allow deleting election authorities" 
  ON public.election_authorities 
  FOR DELETE 
  USING (true);
;
