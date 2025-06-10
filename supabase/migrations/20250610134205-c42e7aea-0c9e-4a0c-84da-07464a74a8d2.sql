
-- Create table for discrete log lookup
CREATE TABLE public.discrete_log_lookup (
  point_string TEXT NOT NULL PRIMARY KEY,
  discrete_log_value INTEGER NOT NULL
);

-- Enable RLS (though we'll make it publicly readable)
ALTER TABLE public.discrete_log_lookup ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read the lookup table (mathematical constants)
CREATE POLICY "Anyone can view discrete log lookup" 
  ON public.discrete_log_lookup 
  FOR SELECT 
  USING (true);

-- Create function to initialize the discrete log table
CREATE OR REPLACE FUNCTION public.initialize_discrete_log_table(max_value INTEGER DEFAULT 100)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  record_count INTEGER;
BEGIN
  -- Check if table is already populated
  SELECT COUNT(*) INTO record_count FROM public.discrete_log_lookup;
  
  IF record_count > 0 THEN
    RETURN record_count; -- Already initialized
  END IF;
  
  -- Note: The actual point generation will be done in the application layer
  -- This function will be called after the application inserts the records
  RETURN 0;
END;
$$;

-- Create function to get discrete log value
CREATE OR REPLACE FUNCTION public.get_discrete_log(point_str TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT discrete_log_value INTO result 
  FROM public.discrete_log_lookup 
  WHERE point_string = point_str;
  
  RETURN result;
END;
$$;

-- Create function to clear the lookup table (admin only)
CREATE OR REPLACE FUNCTION public.clear_discrete_log_table()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.discrete_log_lookup;
END;
$$;
