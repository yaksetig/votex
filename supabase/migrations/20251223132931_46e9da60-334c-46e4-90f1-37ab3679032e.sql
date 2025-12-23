-- Delete the incorrect no_votes record for the Christmas election
-- This record was created before the bug fix when votes were incorrectly assigned
DELETE FROM no_votes 
WHERE election_id = 'bea7bd94-aba9-4ef9-b22a-e45d3b068489';