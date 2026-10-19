# Votex UX remediation plan

Closes all 165 findings in `docs/UX_AUDIT.md` (UX-001…UX-165) without changing protocol behaviour. Saved copy for the repo: this plan is committed as `docs/UX_REMEDIATION_PLAN.md` in the first phase so it can be referred to and ticked off.

## Status

All ten phases (A–J) landed on `main` between 2026-10-18 and 2026-10-19. Every UX id in `docs/UX_AUDIT.md` carries a `Status: Resolved in Phase …` line. The migration from Phase D is applied to the live project and `create-election` is redeployed.

## Context

The 2026-10-17 interface audit found that Votex's flows work but mislead voters at the moment of acting (public-ballot disclosure, premature "Final Results"), leak the nullification choice on screen, drown users in toasts, drop keyboard focus after every major action, and carry a long tail of accessibility, copy and visual-consistency gaps. The user's decisions for this plan:

- **Routes change, with redirects**: `/sign-in`, `/profile`, `/authority`, `/authority/elections/:id`; old paths keep working.
- **Running tally becomes a per-election setting** chosen at creation ("Show running results while voting"), so both behaviours exist. This is the one change that needs a migration and an edge-function change.
- **Explainer pages consolidate** into one "How Votex works" page with anchors; `/privacy` and `/audit-protocol` remain reachable.
- **Theming stays light-only** (`color-scheme: light`, dead dark/sidebar config removed).

Everything else is frontend-only. Exploration confirmed the data needed is already readable by the client: `public_tallies` (tally ran + per-pseudonym outcome), `public_participants` (pseudonym ↔ key ↔ `joined_at` index, so delegating by pseudonym needs no backend change), `useWallet().userId` is the voter's own pseudonym, and `VotexApiError.code` already carries server codes to the UI where they are thrown away.

## Ground rules (apply to every phase)

1. **Protocol untouched.** No change to signed messages, ciphertexts, proofs, edge validation, or the `joined_at`-sorted delegate index (`delegationService.ts:250`, `DelegationDialog.tsx:43` must stay byte-identical).
2. **e2e in lockstep.** `e2e/election-lifecycle.spec.ts` and `e2e/public-surfaces.spec.ts` assert ~70 UI strings (see "e2e coupling" below). Every label, heading, toast or route change in a phase updates the spec in the same commit. New tables/functions must be added to `e2e/support/votex-backend.ts` or `unexpectedRequests` fails the run.
3. **Per phase**: `npx tsc -b && npm run lint && npm test && npm run test:e2e`, then commit to `main` and push (as in earlier sessions). Phase D additionally replays migrations locally (`scratchpad/replay.sh`) and applies live (`supabase db push` + `functions deploy create-election`).
4. **Shared homes first.** New helpers go in `src/lib/` (pure) or `src/components/` (shared UI); no re-implementations in pages. `@typescript-eslint/no-unused-vars` is an error, so remove dead props when relabelling.
5. **Tracking.** Each phase ends by marking its UX ids "Resolved (commit sha)" in `docs/UX_AUDIT.md` (add a `Status` line under each entry) so the list can be closed out item by item.

## Phase A — Foundations (shell, feedback, format, errors, test setup)

Closes: UX-106, 107, 109, 111, 112, 116, 117, 118, 130, 131, 141, 143, 151, 153, 160, 161, 162, 163, 164, 165, 066, 147, 062, 073.

**New files**
- `src/lib/format.ts`: `formatDateTime(iso, {withZone:true})` via `Intl.DateTimeFormat` with `timeZoneName:"short"`; `formatRelative(iso)` wrapping date-fns `formatDistanceToNowStrict` (one style everywhere); `pluralize(n, singular, plural?)`; `formatPercentPair(a,b)` (largest-remainder rounding so pairs sum to 100). `src/components/Time.tsx` renders `<time dateTime>` with both absolute and relative text.
- `src/lib/errorMessages.ts`: `MESSAGES: Record<ApiErrorCode, string>` (all 22 codes + `UNKNOWN`), `describeError(err, fallback)` (uses `.code` when `VotexApiError`, never passes raw `error.message` to voters, logs the original). Also a passkey/World ID map for `NotAllowedError`, `InvalidStateError`, PRF-unsupported, IDKit codes (`verification_rejected`, `max_verifications_reached`, …).
- `src/components/StatusPill.tsx`: single renderer for `getElectionStatus()` (`src/lib/electionStatus.ts`) plus tally state: `Open · Closed · Closed early · Tally pending · Tallied`. Replaces the four vocabularies (`Elections.tsx:30-33`, `ElectionDetail.tsx:536-541`, `AuthorityElectionsList.tsx:168-179`, `ElectionAuthorityDashboard.tsx:208,254`).
- `src/components/ConfirmDialog.tsx` on existing `ui/dialog.tsx`: `role="alertdialog"`, props `{title, description, confirmLabel, destructive?, onConfirm, open, onOpenChange}`, focus returns to trigger (Radix default). Used in E/F/H for Cast vote, Revoke delegation, Discard composer, Close Election Early, Replacement tally.
- `src/components/ErrorBoundary.tsx` (class component, "Something went wrong — Reload" panel) wrapping `Suspense` in `App.tsx`.
- `src/components/RouteFocusManager.tsx` mounted inside `BrowserRouter`: on pathname change `window.scrollTo(0,0)` (respecting reduced motion by disabling `scroll-smooth` on `html`), set `document.title`, and focus `<main id="main" tabIndex={-1}>`. Skip link ("Skip to content") as first child of the shell. `src/hooks/usePageTitle.ts` — every page calls it (`"Elections · Votex"`, `"<election title> · Votex"`, `"Receipt <id> · Votex"`, authority pages `"… · Election Authority"`).
- `src/components/LoadingPanel.tsx` (one component with `role="status"` text) replacing the four duplicated loading blocks (`App.tsx:34-43`, `ProtectedRoute.tsx:13-22`, `ElectionAuthority.tsx:35-44`, loopback interstitial) and `src/components/Skeleton.tsx` replacing hand-rolled `animate-pulse` divs. All spinners use `Loader2`.

**Toasts** (`src/hooks/use-toast.ts`, `ui/toast.tsx`, `ui/toaster.tsx`, `App.tsx`)
- Move `<Toaster/>` inside `BrowserRouter`; viewport bottom-anchored on all sizes (`fixed bottom-0 right-0 … pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-4` so it clears the mobile bottom nav); `TOAST_LIMIT = 2`.
- Add optional `key` to `toast()`: `ADD_TOAST` dismisses any open toast with the same key (success replaces the earlier error of the same action). Destructive toasts default `duration: Infinity`; close button gets `sr-only "Dismiss"` and is always visible.
- Remove "Authentication loaded" (`WalletContext.tsx:65-68`), "Secure session restored", "Passkey unlocked" when the panel already changes, "Vote delegated" (banner shows it), "Logged out" → replaced by header state. Keep toasts for errors and for results not otherwise visible.
- Button primitive: add `busy` prop → `aria-busy`, `aria-disabled`, keeps tab order and full opacity, swaps label; convert the ~12 in-progress `disabled` call sites.

**Platform**: `index.css` add `color-scheme: light`, `@media (prefers-reduced-motion: reduce)` global rule (and `motion-safe:` on hover transforms); delete `.ledger-glass/.ledger-divider/.ledger-input`, alias `.civic-card`→`.ledger-panel`, `.civic-label`→`.ledger-eyebrow` (grep-replace the 35+60 uses, delete duplicates); `tailwind.config.ts` remove `darkMode`, `sidebar.*`, `accordion`, `shimmer`, vestigial content globs; `index.html` add `theme-color`, favicon links, `og:image`; `tailwind` `badge.tsx` → `span`, `alert.tsx` title → `div`; remove `TooltipProvider` and the duplicate gradient variant.

**Test setup**: add devDependencies `@testing-library/jest-dom`, `@testing-library/user-event`, `@axe-core/playwright`. `vitest.config.ts` gets `setupFiles: ["src/test/setup.ts"]` (jest-dom matchers, `cleanup`, shims for `ResizeObserver`, `matchMedia`, `scrollIntoView`, `hasPointerCapture`). Keep default env `node`; component tests opt in with `/** @vitest-environment jsdom */`. Unit tests this phase: `format.test.ts`, `errorMessages.test.ts` (covers every `ApiErrorCode`), `useToast` key-dedupe, `StatusPill.test.tsx`, `ConfirmDialog.test.tsx` (focus trap + return + Escape). New `e2e/accessibility.spec.ts`: axe on landing, elections, sign-in, election detail (open + closed), receipt, authority login, authority dashboard — asserts zero `critical`/`serious` violations (initially may need a short allowlist that each later phase empties).

Commit `docs/UX_REMEDIATION_PLAN.md` (this plan) in this phase.

## Phase B — Routes, navigation, information architecture

Closes: UX-097, 098, 099, 100, 101, 102, 103, 104, 105, 043, 044, 050, 051, 084, 092, 013.

- `App.tsx` routes: `/sign-in` (new `SignIn.tsx` = `WorldIDSignIn` only, honours `?next=`), `/profile` (protected; the verified half of today's `Dashboard.tsx`), `/authority`, `/authority/elections/:id` (`ElectionAuthority.tsx` reads `useParams().id` to preselect; `?view=dashboard|audit` reflects the pane), `/how-it-works` (consolidated page), `/faq`. Redirects via `<Navigate replace>`: `/dashboard`→`/profile` if verified else `/sign-in`; `/success`→`/elections`; `/election_authority`→`/authority`; `/elections/:id/authority`→`/authority/elections/:id`; `/privacy`→`/how-it-works#privacy`, `/audit-protocol`→`/how-it-works#audit` **but** keep the two as real short pages (they are linked from the ballot and the receipt) — decision: keep `Privacy.tsx` and `AuditProtocol.tsx` as proper pages built from the same content modules, so `e2e/public-surfaces.spec.ts` continues to pass with text updates only.
- Retire `Success.tsx`: the sign-in page's completion state keeps the heading "Identity Confirmed" and a "Continue to Elections" button (no 1.2 s or 4.5 s timers), so e2e lines 14–15 still match; `ProtectedRoute` fallback becomes `/sign-in?next=<path>`.
- One `isAuthorityRoute(pathname)` in `src/lib/routes.ts` with route constants (`ROUTES.signIn`, …) used by NavBar, AppFooter, ConnectivityBanner and every `navigate`/`Link` (call sites: `NavBar.tsx:32,50,97,113`, `ProtectedRoute.tsx:26`, `Elections.tsx:156`, `ElectionDetail.tsx:721`, `Index.tsx:42,153`, `NotFound.tsx:22`, `WorldIDSignIn.tsx:265`, `AppFooter.tsx:26`). Buttons that navigate become `Link`s.
- One navigation model: desktop and mobile both expose Elections, How Votex works, FAQ, Profile/Sign in; footer adds FAQ and How Votex works, "Operator Entrance" → "Election Authority sign-in". Header "Verified Human" pill becomes a "Profile" link; "Sign in" hidden on `/sign-in`. Mobile bottom nav height exported as a CSS var and the shell gets `pb-[var(--bottom-nav-h)] md:pb-0` (also UX-132).
- `HowItWorks.tsx` rebuilt from `src/content/howItWorks.tsx` sections (voting & public ballots, delegation, nullification & decoys incl. "If you were pressured", privacy, audit) with anchors; `FAQ.tsx` keeps true FAQs; `Index.tsx` loses the duplicate search and the dead ternary; `NotFound.tsx` → "Page not found", "Go to elections".
- e2e: `public-surfaces.spec.ts:19-20` changes to `toHaveURL(/\/authority$/)` after visiting `/election_authority`; lifecycle `goto("/dashboard")` → `/sign-in`, `goto("/election_authority")` → `/authority`. Update `e2e/README.md:12` route typo and README routes.

## Phase C — Sign-in and session

Closes: UX-038, 039, 040, 041, 042, 045, 046, 047, 048, 049, 005.

`WorldIDSignIn.tsx`: one primary "Continue with passkey" + text link "I don't have a Votex passkey yet" (e2e 12/28/29 updated to the new names; keep accessible names exact); status rows rendered as `role="status"` text instead of disabled buttons; step 2 text stays full-opacity (`aria-disabled` on the control only); rp-signature failure renders an inline error with Retry; all errors through `describeError`; key-conflict state offers the documented recovery path text + support link with the error code; watermark gets reserved padding. `NavBar`: labelled "Sign out" (icon + text on desktop, tooltip-free), confirm via `ConfirmDialog`; `Profile` page gets a "Sign out" button. `WalletContext.tsx`: on expiry toast "Your session expired. Sign in again" with `key:"session"` and navigate to `/sign-in?next=`; sign-out failure copy rewritten. `ElectionDetail` unlock panel adds "Your voting key is kept per tab; unlock to continue." Copy: "Your voting key is derived in this browser and is never sent to Votex" replaces "never leaves this device" (`WorldIDSignIn.tsx:407`, `Dashboard/Profile`, `HowItWorks`, `FAQ`).

## Phase D — Elections list, creation, edit, running-tally setting

Closes: UX-052, 053, 054, 055, 056, 057, 058, 059, 060, 061, 063, 064, 065, 115, 031, 010, 033.

**Backend (the only migration in this plan)** — `supabase/migrations/20261018000000_election_running_tally_setting.sql`:
- `ALTER TABLE public.elections ADD COLUMN show_running_tally boolean NOT NULL DEFAULT true;`
- `DROP FUNCTION public.create_election_atomic(text, uuid, text, text, text, text, timestamptz, uuid);` and recreate with a trailing `p_show_running_tally boolean DEFAULT true` written into the insert; re-issue `REVOKE … FROM PUBLIC, anon, authenticated` / `GRANT EXECUTE … TO service_role` on the new signature.
- `update_election_details_atomic`: allow key `show_running_tally` (boolean) in the key whitelist and the assignment block.
- `CREATE OR REPLACE VIEW public.public_elections` adding `show_running_tally` as the last column (grants persist).
- Verify with `scratchpad/replay.sh`, extend `src/__tests__/preproductionBoundaries.test.ts` if it pins the view column list, regenerate/extend `src/integrations/supabase/types.ts`.
- Edge: extract `supabase/functions/create-election/handler.ts` per the handler convention; accept `showRunningTally?: boolean` (reject non-boolean with `VALIDATION_ERROR`), pass `p_show_running_tally`; add `handler.test.ts` using `fakeSupabase`. Run `deno test --frozen` from `supabase/functions/`. Apply live after merge.
- e2e stub `votex-backend.ts` `create-election`: `show_running_tally: body.showRunningTally ?? true`; `update_election_details_atomic` passes it through.

**Frontend**
- `ElectionForm/schema.ts`: `showRunningTally: z.boolean().default(true)`, distinct-options refinement (trimmed, case-insensitive), max messages state the limit; `types.ts` endDate message "Choose a closing date in the future". `ElectionForm.tsx`: labelled "Closing date and time" (`<Label htmlFor="endDate">`, `min` = now, default +7 days, zone hint), a checkbox/switch "Show running results while voting" with helper text ("Off: counts stay hidden until the election closes"), required markers, counters, `aria-invalid` + `aria-describedby` + `role="alert"` messages; composer becomes a dialog-free dedicated section with `aria-expanded` and focus moved in, "Close composer" confirms discard when dirty; placeholders fixed. `electionCreationService.ts` sends `showRunningTally`. `ElectionEditForm.tsx`: local-time formatting (`format(date, "yyyy-MM-dd'T'HH:mm")`), same label/toggle, delete the dead unsafe-edit branch, "Saving records this change in the audit trail."
- `Elections.tsx`: branch empty states ("No elections yet" vs "No matches", reset only when filtered); card title is a stretched link + 44 px CTA; sort label `sr-only sm:not-sr-only`; error state with Retry (no empty state when `isError`); pagination `aria-disabled` + live indicator + scroll to list heading; `<Time>` for dates; `pluralize`; counts say "votes"; cards of elections with `show_running_tally=false` show "Results after close" instead of a bar; after publish navigate to the new election (e2e 24-25 updated: toast still fires, heading assertion now on the detail page).
- `useElectionsList.ts` `ElectionRecord` gains `show_running_tally`.

## Phase E — Election detail: disclosure, ballot, results, delegation

Closes: UX-001, 002, 003, 008, 011, 025, 026, 027, 028, 029, 030, 032, 034, 035, 036, 037, 108 (detail part), 110, 127.

- **Disclosure at the point of casting**: line above the button "This publishes “{option}” under your pseudonym {abbr(userId)}, visible to anyone, permanently. Casting also registers your voting key for this election." with a link to `/privacy`. `ConfirmDialog` before `castVote` ("Publish ‘…’? This cannot be undone."). e2e: after clicking "Cast vote", click the confirm button "Publish ballot".
- **Options** use `RadioGroup` (`radiogroup`/`radio`, `aria-checked`, visible check icon), heading moved out of the control, grid with stats row pinned; accessible name stays "Option A Approve…" (e2e regex `/Option A\s+Approve/` keeps matching the radio's label). Keep "Cast vote" enabled; helper text explains why it can't proceed ("Select an option" / "Unlock your passkey first").
- **Running tally setting**: when `show_running_tally` is true, the distribution shows in the results sidebar (not on the options); when false, the sidebar says "Results are published when the election closes" and counts are omitted from the page and list.
- **Results & tally status**: `ElectionDetail` reads `public_tallies` (`getElectionTallyResults`, extend select with `processed_at`) and renders, when closed: no tally → "Preliminary results · pending Election Authority tally" with raw counts, no Winner badge; tally present → "Tallied on <Time>" using tallied weights (`voteWeight`, `voteNullified` joined to `public_votes`) with Winner/Tie badges. `formatPercentPair` for rounding. Telemetry card: real values only (remove fixed bar, label "Registered participants" vs "Ballots"), "Delegated ballots count for the delegate at tally".
- **Pseudonym**: shown on `/profile` and in the ballot panel ("You appear in public records as …", copy button); own rows highlighted in audit tables (Phase G).
- **Delegation**: `DelegationDialog` lists participants by pseudonym (searchable, paste field resolves `voter_pseudonym` or public key), excludes self, rejects unknown pseudonyms with inline error, resets selection on open, `aria-labelledby` on the group; explains "Only one hop counts: if your delegate delegates, both ballots are dropped" and the registration side effect. `delegationService` `createDelegation/revokeDelegation` throw `VotexApiError` via `readFunctionError`; revoke gets busy state, failure toast, `ConfirmDialog`. e2e 32: `getByLabel(/e2e-delegate-pseudonym/)`.
- Error/not-found split for the election fetch (one inline message + Retry, no duplicate toast); vote-status/delegation-status fetch failures render an error state instead of the ballot. Success toast "Ballot recorded. Your receipt is below. You can nullify it until <date>." (e2e 41 updated).

## Phase F — Nullification

Closes: UX-014, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 122, 123.

- **Panel** (`ElectionDetail.tsx:729-763`): one button "Submit nullification request"; copy: what it is, that anyone may send decoys and why ("Decoys protect voters who need the real thing"), irreversibility ("After a real nullification you cannot cast a new ballot in this election"), the window end date, duration ("takes about N seconds and keeps this tab busy" — measured once via `performance.now()` around proof generation and shown on later runs; first run says "up to a minute"), and "If you were pressured" guidance linking to `/how-it-works#pressure`. After close: "Nullification closed with the election on <date>".
- **`NullificationDialog`**: two visually identical cards, identical icon, neutral labels ("Nullify my ballot" / "Send a decoy"), no "Type-0", footer "Nothing on this screen is recorded; only the encrypted request is published. You may send as many requests as you like." e2e 50/51: button `/Submit nullification request/`, then `/Send a decoy/`.
- **Cancel + honest progress**: `generateProofsInParallel(inputs, onProgress, signal?)` terminates workers and rejects with `AbortError` on abort (stub keeps the same signature; extra optional arg); `KAnonymityNullificationService` and `submitNullificationWithRetry` accept `signal`; the flow emits a new `step: "submitting"` before calling `submit` and never aborts after that point; aborted runs throw `NullificationFlowError("CANCELLED")`. `KAnonymityProgressDialog`: `role="progressbar"` with `aria-valuenow`, throttled `aria-live` sentence from a step→copy map ("Preparing your request", "Hiding your request among N participants", "Building proof 3 of 6", "Another voter submitted at the same time, retrying", "Sending"), guard `total === 0` (indeterminate bar, no NaN), a "Cancel" button enabled until "submitting", close button hidden, visible DialogTitle (no duplicate sr-only). k=1 case says plainly the request is not hidden. After success: neutral confirmation panel ("Submitted. This page will not change, by design.") and toast with correct pluralisation.
- Tests: extend `nullificationFlow.test.ts` (abort before submit → CANCELLED, abort after submitting ignored, "submitting" emitted once per attempt); `NullificationDialog.test.tsx` (identical classes/icons, no "actual"/"dummy" text); `KAnonymityProgressDialog.test.tsx` (no NaN, Cancel calls abort, disabled during submitting).

## Phase G — Receipts and public audit ledger

Closes: UX-007, 009, 012, 067, 068, 069, 070, 071, 072, 074, 075, 076, 077, 078, 124.

- `VoteReceiptCard`: states "Verified / Could not verify yet / Invalid signature" with distinct tones; explains what was checked and that a receipt proves acceptance, not that the ballot counts (nullification note); technical details (signature JSON) collapsed; copy icon copies the fingerprint; "Verify Receipt" renamed "Open receipt page" (e2e 42 → `getByRole("link",{name:"Open receipt page"})`) and hidden on the receipt page itself; export JSON drops `signatureVerified`; no "Election" fallback title. `VoteReceipt.tsx`: separate error (Retry) from not-found; offline verifier form ("Paste a receipt JSON") using the existing verification path.
- `ElectionPublicAudit`: Radix `Tabs` (keeps `role="tab"`), `th scope`, `<caption>`, focusable scroll container, full identifiers on expand with copy, own-pseudonym rows highlighted, human action labels with the raw action in a `title`, a one-line legend per tab, "Load more" stays mounted with `aria-busy`, `<Time>`; add "Delegations" and "Nullification proofs" tabs reading `public_delegations`/`public_nullifications` (both anon-readable; add both tables to the stub's `tableRows` — already present) so `AuditProtocol` claims hold. e2e 76/77 unchanged (raw action still rendered inside the cell).

## Phase H — Authority console

Closes: UX-006, 079, 080, 081, 082, 083, 085, 086, 087, 088, 089, 090, 091, 093, 094, 095, 096, 121, 134, 135.

- Landmarks: console renders outside App's `<main>` (its own layout route) or as `<div>`s; brand becomes `<p>`; one `h1` per view; sidebar `nav aria-label` + `aria-current`; "Back to Votex" link; tabs become a scrollable strip on narrow widths; stat tiles reduced to real data (ballots, participants, delegations, requests) in a compact two-column grid; session pill moves to the sidebar.
- `AuthorityElectionsList`: `StatusPill` ("Not yet tallied" neutral while open), per-row `aria-label` on "Open" buttons.
- `ElectionAuthorityDashboard`: "Close Election Early" → destructive `Button` + `ConfirmDialog` naming the consequence (voters lose the nullification window); e2e 65-66: remove `page.once("dialog")`, click the dialog's "Close election" confirm. Tally result panel stays mounted after success (lift `tallyResults` into the dashboard; "Start replacement tally" lives there behind `ConfirmDialog`); no instant `refreshKey` remount of the result view.
- `ElectionAuthorityInterface`: keep the secret on recoverable errors, reveal toggle, `autoComplete`, live status text during processing, `describeError` (tally errors shown as "Tally could not be completed: <safe reason>" with the pseudonym abbreviated), result copy "Tally run completed <Time>" and plural-safe sentences, operator name from the session.
- `TallyResultsDisplay`/`TallyResultsChart`: Final series only when `public_tallies` rows exist, legend + `accessibilityLayer`, darker ticks, "Nullification requests (incl. decoys)" with explanation, processed-voter table paginated with "n of N", `processed_at` instead of local `new Date()`.
- `ElectionAuthorityLogin`: hint only in link mode, plain language, inline `role="alert"` only, `aria-invalid`, reveal toggle, `autoComplete`. `AuthorityAuditLog`: action labels + operator display name.

## Phase I — Copy, terminology, docs

Closes: UX-004, 139, 140, 142, 144, 145, 146, 148, 149, 150, 113, 114.

- `docs/GLOSSARY.md` (and a short block in CONTRIBUTING.md): passkey (credential) · voting key (derived key) · unlock (verb) · ballot (record) / vote (act) · nullify · decoy · pseudonym · Election Authority (role) / operator (person) / Election Authority console (surface) · public record (never "ledger"). Sentence case for all buttons and headings; "…" character.
- Sweep every page/component for the glossary, removing "BabyJubJub", "XOR accumulator", "Groth16", "Serialized signature", "telemetry", "Ledger composer", "Type-0" from voter surfaces (technical detail lives in `/audit-protocol` and CRYPTOGRAPHY.md). Rewrite contradictory claims (coercion *mitigation*; "everyone can see that you delegated, only the Election Authority can see to whom"; drop "one person, one vote" or qualify). Offline banner copy and sign-out failure copy fixed.
- e2e strings updated for every renamed label (expected renames: "Create Election"→"Create election", "Publish Election"→"Publish election", "Delegate Vote"→"Delegate ballot", "Revoke Delegation"→"Revoke delegation", "Secure Sign In"→"Sign in", "Manage Dashboard"→"Open", "Begin Tally Processing"→"Run tally", "Process Tally"→"Run tally" tab, "Election Authority Admin Panel"→"Elections"). README product steps and `e2e/README.md` updated.

## Phase J — Accessibility, mobile and visual sweep

Closes: UX-119, 120, 125, 126, 128, 129, 132, 133, 136, 137, 138, 152, 154, 155, 156, 157, 158, 159.

- Contrast: replace `text-outline` on text with `text-on-surface-variant`, darken placeholders in `ui/input.tsx`/`ui/textarea.tsx`, chart ticks; floor type at `text-xs` (remove all `text-[10px]`/`text-[11px]`); min 44 px targets (`size="sm"` becomes 44 px tall on touch via `min-h-11`); `text-base md:text-sm` on inputs (iOS zoom); `aria-hidden` on decorative icons (codemod: lucide icons without an accessible parent label); remove footer `aria-label` overrides; `AuditProtocol` ordered list without manual numbers.
- Mobile: shell bottom padding (from Phase B var), toast placement (Phase A), in-page search field below `lg`, sticky "Cast vote" action bar on phones showing the selected option, footer two-column stack.
- Visual: one `PageHeader` component (eyebrow + h1 + actions) and one container width; `Card`/`StatCard` components replacing the repeated recipe; two border tokens and three radii; map off-palette colours (`blue-50`, `green-100`, `bg-white/80`, shadcn tokens in `DelegationDialog`) to theme tokens; label/eyebrow/display type tokens in `tailwind.config.ts`; icon sizes 16/20/32; info tone for the public-ballot notice; all buttons through `Button`.
- Empty the axe allowlist from Phase A; `e2e/accessibility.spec.ts` must pass with zero critical/serious.

## e2e coupling (checklist kept with the plan)

Strings/handles asserted today and where they change: `/dashboard`(B) · "Create a New Votex Passkey"/"Use an Existing Votex Passkey"(C) · "Identity Confirmed"/"Continue to Elections"(B, kept) · "Create Election"/"Publish Election"/"Election published"(D, I) · `#endDate` → `getByLabel("Closing date and time")`(D) · "Vote" exact(D card CTA keeps "Vote") · "Cast your ballot"(E) · "Unlock Passkey"/"Passkey unlocked"(C/E, toast removed → wait for panel text) · "Delegate Vote"/"Participant #1"/"Delegate"/"Vote delegated"/"Revoke Delegation"/"Delegation revoked"(E, I) · `/Option A\s+Approve/`(E radio label) · "Cast vote" + new confirm "Publish ballot"(E) · "Public ballot receipt"/"Vote cast successfully"/"Verify"/"Verify ballot receipt"/"Verified"(E, G) · "Submit a Nullification"/"Nullify Vote"/"Dummy Nullification"/"Nullification request submitted"(F) · `/election_authority`(B) · "Secure Sign In"/"Election Authority Admin Panel"/"Manage Dashboard"(H, I) · window.confirm for "Close Election Early"(H) · "Process Tally"/"Authority secret"/"Begin Tally Processing"/"Tally processed"(H, I) · "Audit Trail"/"CLOSE_ELECTION"/"Delegation revoked"(G, unchanged) · public-surfaces: "Privacy model", "Audit protocol", "3. Nullification:"/"4. Delegation:"(B/J: keep text, drop manual numbers → update to "Nullification"), `/election_authority$`(B), "Sign in to continue"(H), Privacy/Audit Protocol/Support links(C). Also fix the duplicate `target_pseudonym` key at `votex-backend.ts:480-481`.

## Verification

- Per phase: `npx tsc -b`, `npm run lint`, `npm test`, `npm run test:e2e` (chromium + mobile), `deno test --frozen` for Phase D, `npm run build`, `npm run release:check`.
- After Phase D: `scratchpad/replay.sh` migration replay, then live `supabase db push` and `functions deploy create-election`; zero-row PATCH probe on `public_elections` still 401/403.
- After Phase J: re-run the screenshot tour (`npm i -D @axe-core/playwright` is now permanent, so `npx playwright test --config .ui-tour/playwright.config.ts` works directly); confirm `records.json` shows unique titles per route, focus never on `<body>` after actions, zero axe violations; spot-check the 54 desktop/mobile screenshots against the audit items.
- Close-out: every UX id in `docs/UX_AUDIT.md` carries a `Status: Resolved (sha)` line; final counts in the artifact page updated by republishing `docs/UX_AUDIT.md` content.

## Coverage map (all 165)

A: 062 066 073 106 107 109 111 112 116 117 118 130 131 141 143 147 151 153 160–165 · B: 013 043 044 050 051 084 092 097–105 · C: 005 038–042 045–049 · D: 010 031 033 052–061 063–065 115 · E: 001–003 008 011 025–030 032 034–037 108 110 127 · F: 014–024 122 123 · G: 007 009 012 067–072 074–078 124 · H: 006 079–083 085–091 093–096 121 134 135 · I: 004 113 114 139 140 142 144–146 148–150 · J: 119 120 125 126 128 129 132 133 136–138 152 154–159.
