-- Enable real-time updates for the elections table
-- This will allow the Elections page to receive real-time updates when elections are closed

-- Set replica identity to FULL to ensure complete row data is captured during updates
ALTER TABLE public.elections REPLICA IDENTITY FULL;

-- Add the elections table to the supabase_realtime publication
-- This enables real-time subscriptions for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.elections;