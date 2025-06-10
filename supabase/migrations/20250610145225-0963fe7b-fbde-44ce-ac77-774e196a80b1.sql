
-- Add new fields to elections table for better election management
ALTER TABLE public.elections 
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed_manually', 'expired')),
ADD COLUMN closed_manually_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_modified_by TEXT,
ADD COLUMN last_modified_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create function to automatically update last_modified_at
CREATE OR REPLACE FUNCTION update_last_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update last_modified_at on elections table
CREATE TRIGGER update_elections_last_modified_at
  BEFORE UPDATE ON public.elections
  FOR EACH ROW
  EXECUTE FUNCTION update_last_modified_at();

-- Create audit log table for election authority actions
CREATE TABLE public.election_authority_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL,
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  details JSONB,
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log table
ALTER TABLE public.election_authority_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read audit logs (for transparency)
CREATE POLICY "Anyone can view election audit logs" 
  ON public.election_authority_audit_log 
  FOR SELECT 
  USING (true);
