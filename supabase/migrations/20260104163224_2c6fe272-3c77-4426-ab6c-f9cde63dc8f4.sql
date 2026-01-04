-- Clean up duplicate entries where voter exists in both yes_votes AND no_votes for same election
-- Keep the entry that matches the actual vote in the votes table

-- First, delete from yes_votes where the actual vote was NOT option1
DELETE FROM yes_votes 
WHERE (election_id, voter_id) IN (
  SELECT yv.election_id, yv.voter_id
  FROM yes_votes yv
  INNER JOIN no_votes nv ON yv.election_id = nv.election_id AND yv.voter_id = nv.voter_id
  INNER JOIN votes v ON v.election_id = yv.election_id AND v.voter = yv.voter_id
  INNER JOIN elections e ON e.id = v.election_id
  WHERE v.choice != e.option1
);

-- Then, delete from no_votes where the actual vote was option1
DELETE FROM no_votes 
WHERE (election_id, voter_id) IN (
  SELECT nv.election_id, nv.voter_id
  FROM no_votes nv
  INNER JOIN yes_votes yv ON nv.election_id = yv.election_id AND nv.voter_id = yv.voter_id
  INNER JOIN votes v ON v.election_id = nv.election_id AND v.voter = nv.voter_id
  INNER JOIN elections e ON e.id = v.election_id
  WHERE v.choice = e.option1
);