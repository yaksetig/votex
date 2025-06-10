
-- Link existing elections to the default election authority
-- First, get the ID of the first election authority
UPDATE public.elections 
SET authority_id = (
  SELECT id 
  FROM public.election_authorities 
  LIMIT 1
)
WHERE authority_id IS NULL;

-- Add a foreign key constraint to ensure elections are always linked to an authority
ALTER TABLE public.elections 
ADD CONSTRAINT fk_elections_authority 
FOREIGN KEY (authority_id) REFERENCES public.election_authorities(id);
