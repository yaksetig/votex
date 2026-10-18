/**
 * Every in-app path in one place. Components link through these constants
 * so a route can move without a grep across the codebase, and so the shell
 * (NavBar, AppFooter) can tell authority pages from voter pages with one
 * predicate.
 */

export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  profile: "/profile",
  elections: "/elections",
  election: (id: string) => `/elections/${id}`,
  receipt: (receiptId: string) => `/receipts/${receiptId}`,
  howItWorks: "/how-it-works",
  faq: "/faq",
  privacy: "/privacy",
  auditProtocol: "/audit-protocol",
  authority: "/authority",
  authorityElection: (id: string) => `/authority/elections/${id}`,
} as const;

/** Anchors inside the consolidated "How Votex works" page. */
export const HOW_IT_WORKS_SECTIONS = {
  voting: "voting",
  delegation: "delegation",
  nullification: "nullification",
  pressure: "pressure",
  privacy: "privacy",
  audit: "audit",
} as const;

export function howItWorksSection(section: keyof typeof HOW_IT_WORKS_SECTIONS): string {
  return `${ROUTES.howItWorks}#${HOW_IT_WORKS_SECTIONS[section]}`;
}

/** Old paths that still resolve, so bookmarks and shared links keep working. */
export const LEGACY_ROUTES = {
  dashboard: "/dashboard",
  success: "/success",
  electionAuthority: "/election_authority",
  electionAuthorityById: "/elections/:id/authority",
} as const;

/** The Election Authority console renders its own shell without the voter chrome. */
export function isAuthorityRoute(pathname: string): boolean {
  return (
    pathname === ROUTES.authority ||
    pathname.startsWith(`${ROUTES.authority}/`) ||
    pathname === LEGACY_ROUTES.electionAuthority ||
    /^\/elections\/[^/]+\/authority$/.test(pathname)
  );
}

/** Sign-in URL that returns the voter to `next` afterwards. */
export function signInPath(next?: string | null): string {
  if (!next || next === ROUTES.signIn || !next.startsWith("/")) {
    return ROUTES.signIn;
  }
  return `${ROUTES.signIn}?next=${encodeURIComponent(next)}`;
}

/** Only same-origin paths are honoured as a post-sign-in destination. */
export function safeNextPath(next: string | null | undefined, fallback: string = ROUTES.elections): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next === ROUTES.signIn) {
    return fallback;
  }
  return next;
}
