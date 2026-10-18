import type { ElectionParticipant } from "@/services/electionParticipantsService";

/**
 * Sorts participants exactly like the tally does (joined_at ascending): the
 * index into this list is what gets encrypted, so the order must stay
 * byte-identical to resolveDelegations in delegationService.ts.
 */
export function sortParticipantsForDelegation(participants: ElectionParticipant[]): ElectionParticipant[] {
  return [...participants].sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
}

/**
 * Finds a delegate by pseudonym or public key (either coordinate, or
 * "x,y") and returns the stable index the tally expects, or null when no
 * other participant matches. The voter themself never matches.
 */
export function resolveDelegateIndex(
  sorted: ElectionParticipant[],
  query: string,
  currentUserId: string
): number | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const index = sorted.findIndex((p) => {
    if (p.participant_id === currentUserId) return false;
    const key = `${p.public_key_x},${p.public_key_y}`.toLowerCase();
    return (
      p.participant_id.toLowerCase() === needle ||
      p.public_key_x.toLowerCase() === needle ||
      p.public_key_y.toLowerCase() === needle ||
      key === needle
    );
  });
  return index === -1 ? null : index;
}
