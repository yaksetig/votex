import { useQuery } from "@tanstack/react-query";
import { getElectionsForAuthority } from "@/services/electionDataService";

// Elections owned by a given authority, for the authority dashboard list.
export function useAuthorityElections(authorityId: string) {
  return useQuery({
    queryKey: ["authority-elections", authorityId],
    queryFn: () => getElectionsForAuthority(authorityId),
    enabled: Boolean(authorityId),
  });
}
