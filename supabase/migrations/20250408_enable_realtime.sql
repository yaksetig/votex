
-- Enable realtime for elections and votes tables
BEGIN;
  -- Add tables to the publication
  ALTER PUBLICATION supabase_realtime ADD TABLE elections;
  ALTER PUBLICATION supabase_realtime ADD TABLE votes;

  -- Set replica identity to FULL to track all fields in changes
  ALTER TABLE elections REPLICA IDENTITY FULL;
  ALTER TABLE votes REPLICA IDENTITY FULL;
COMMIT;
