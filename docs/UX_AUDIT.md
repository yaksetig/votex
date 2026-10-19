# Votex Interface Audit (2026-10-17)

Scope: all voter and authority screens, driven in a browser at 1440px and Pixel 7 against the e2e stubs, scanned with axe, plus a full source read. Commit 92c7d87.

- Critical: 4
- High: 49
- Medium: 85
- Low: 27

## Do these first

1. **No public-ballot disclosure or pseudonym at the moment of casting** (UX-001)
2. **The screen itself reveals which nullification a voter chose** (UX-014)
3. **“Final Results” and a “Winner” badge appear the moment an election closes, before any tally** (UX-002)
4. **No reason is ever given to send a decoy** (UX-015)
5. **Duration and CPU cost are not disclosed before starting; the progress dialog cannot be dismissed** (UX-017)
6. **“Authentication loaded / Your human identity has been restored” fires on every page load** (UX-106)
7. **Error toasts auto-dismiss in five seconds and old ones stack** (UX-107)
8. **No focus management after dialogs close or actions complete** (UX-117)
9. **Every route is titled “Votex”** (UX-160)
10. **Edit form writes UTC into a datetime-local input, shifting the deadline on save** (UX-052)
11. **Deadline input has no label, no minimum, no default and no timezone hint** (UX-053)
12. **Two primary-looking choices on the sign-in card** (UX-038)
13. **World ID and passkey errors surface as raw codes** (UX-040)
14. **Delegation target is an unstable, anonymous “Participant #N”** (UX-028)
15. **Tally success view and “Start Replacement Tally” vanish immediately after success** (UX-079)
16. **Close Election Early is a destructive action styled as primary and confirmed by window.confirm** (UX-080)
17. **Fixed bottom navigation covers content and the footer** (UX-132)
18. **/dashboard is the sign-in page and is labelled eight different ways** (UX-097)
19. **“Verify Receipt” is circular** (UX-067)
20. **Security claims contradict each other across pages** (UX-004)

## Trust and disclosure (13)

_What the voter is told about what their action does and who can see it._

### UX-001 · Critical · No public-ballot disclosure or pseudonym at the moment of casting

- **Where:** src/pages/ElectionDetail.tsx:702-710 (Cast vote button); sidebar card :813-818
- **Evidence:** The only on-page statement that the ballot is public sits in a sidebar card that renders below the ballot on phones. Nothing next to the button names the pseudonym the choice will be published under.
- **Change:** Add one line directly above the button: "This publishes “{option}” under your pseudonym {abc…xyz}, visible to anyone, permanently." Link to the privacy page from it.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-002 · Critical · “Final Results” and a “Winner” badge appear the moment an election closes, before any tally

- **Where:** ElectionDetail.tsx:588-637 (screenshot 50)
- **Evidence:** Observed with one ballot: the closed view shows “Final Results”, “100%” and “Winner” computed from raw ballots. Nullifications and delegation weights are only resolved by the authority tally, which has not run.
- **Change:** Label the panel “Preliminary results, pending Election Authority tally” until a tally run exists, then show the tallied result and the tally timestamp.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-003 · High · Tally status is never shown to voters

- **Where:** ElectionDetail.tsx (no tally banner); public_tallies is read only by the authority view
- **Evidence:** A voter cannot tell whether the result they see is pre- or post-tally.
- **Change:** Show “Tally processed on ” (or “Tally pending”) on the closed-election page and surface tallied counts there.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-004 · High · Security claims contradict each other across pages

- **Where:** HowItWorks.tsx:64,96 (“coercion resistance”) vs Privacy.tsx:9 (“the receipt is not coercion-resistant”); HowItWorks.tsx:101 (“One person, one vote”) vs delegation; ElectionDetail.tsx:92,686 (“privately delegated”) vs Privacy.tsx:10
- **Evidence:** Two pages one click apart make opposite statements.
- **Change:** Use “coercion mitigation” consistently; say “everyone can see that you delegated, only the Election Authority can see to whom”; drop “one person, one vote” or qualify it.

### UX-005 · High · “Local key never leaves this device” overstates what happens

- **Where:** WorldIDSignIn.tsx:407; Dashboard.tsx:50,140; HowItWorks.tsx:54; FAQ.tsx:18
- **Evidence:** The seed and scalar are written to sessionStorage for the tab lifetime and the PRF secret seeds a server-side verifier. The key is not sent to Votex, which is the true claim.
- **Change:** Say “Your voting key is derived in this browser and is never sent to Votex. It stays in this tab until you sign out or close it.”
- **Status:** Resolved in Phase C (sign-in and session)

### UX-006 · High · “Final decryption finished successfully” and “official result set” next to a replacement-tally button

- **Where:** ElectionAuthorityInterface.tsx:99-102,176,195
- **Evidence:** The copy declares finality while offering to redo the tally.
- **Change:** “Tally run completed” plus the run timestamp; describe replacement as a new run that supersedes this one.
- **Status:** Resolved in Phase H (authority console)

### UX-007 · High · Receipts never mention nullification

- **Where:** VoteReceiptCard.tsx:113; VoteReceipt.tsx:91
- **Evidence:** A receipt can show “Signature Verified” for a ballot that was later nullified. Nothing says what a receipt does and does not prove.
- **Change:** Add “A receipt proves the ballot was accepted. Whether it counts is decided at tally and may change if the voter nullifies.”
- **Status:** Resolved in Phase G (receipts and public records)

### UX-008 · Medium · Voter pseudonym is only visible after voting

- **Where:** Dashboard.tsx:88-90 shows public key X/Y, not the pseudonym used in the ledger; VoteReceiptCard.tsx:66-67
- **Evidence:** Voters cannot find their own rows in the public ledger before they have a receipt.
- **Change:** Show the pseudonym on the profile with “This is how you appear in public records”, and highlight the viewer's own rows in the ledger tables.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-009 · Medium · Delegation and nullification requests are not auditable from the UI

- **Where:** AuditProtocol.tsx:10-11 promises it; ElectionPublicAudit.tsx has only ballots, participants, audit-trail tabs
- **Evidence:** The audit page says auditors can inspect delegation ciphertexts and proofs, but no tab exposes them.
- **Change:** Add tabs (or downloads) for delegation records and nullification proofs, or remove the claim.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-010 · Medium · “{n} verified votes” where nothing is verified

- **Where:** ElectionDetail.tsx:613,635,675,792; Elections.tsx:234 says plain “votes”
- **Evidence:** Counts come straight from the tracking tables.
- **Change:** Use “votes” everywhere; reserve “verified” for receipt signature checks.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-011 · Medium · Decorative elements read as live data

- **Where:** ElectionDetail.tsx:795-797 (progress bar fixed at w-11/12); Dashboard.tsx:72-73 (“Passkey: Active” hard-coded); ElectionAuthorityDashboard.tsx:234 (constant “2 Voting options” tile); Index.tsx:87 (fake receipt id)
- **Evidence:** Each of these looks like a measurement and is not.
- **Change:** Remove them or bind them to real state.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-012 · Medium · Exported receipt JSON asserts its own verification

- **Where:** VoteReceipt.tsx:61-71 includes signatureVerified: true computed client-side
- **Evidence:** A third party receiving the file sees a verification flag the file cannot vouch for.
- **Change:** Strip the flag from the export; include the public key and the message so others can verify.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-013 · Low · “Verified Human” header pill looks like a badge but is a link

- **Where:** NavBar.tsx:101
- **Evidence:** It navigates to the profile; nothing indicates that.
- **Change:** Style it as a link to “Profile” or make it a non-interactive status plus a separate profile link.
- **Status:** Resolved in Phase B (routes and navigation)


## Nullification (11)

_The coercion-resistance flow is the product's reason to exist; its UI currently undermines it._

### UX-014 · Critical · The screen itself reveals which nullification a voter chose

- **Where:** ElectionDetail.tsx:737-759; NullificationDialog.tsx:48-82 (screenshot 32)
- **Evidence:** Two cards with different icons (shield vs ghost) and the labels “Actual” and “Dummy”. The privacy guarantee covers the network, not someone looking at the phone. Panel copy even instructs: “If you were coerced, use Actual Nullification”.
- **Change:** One button, “Submit nullification request”. Inside, two visually identical cards with neutral labels and identical icons, plus “Nothing on this screen is recorded; only the encrypted request is published.”
- **Status:** Resolved in Phase F (nullification)

### UX-015 · Critical · No reason is ever given to send a decoy

- **Where:** NullificationDialog.tsx:73-82; HowItWorks.tsx:66
- **Evidence:** Decoys only protect coerced voters if honest voters send them. No copy asks anyone to.
- **Change:** Add: “Anyone can send decoys at any time. Doing so protects voters who need the real thing.” Consider prompting every voter to send one after casting.
- **Status:** Resolved in Phase F (nullification)

### UX-016 · High · Irreversibility and no re-vote are not stated at the point of action

- **Where:** ElectionDetail.tsx:733-759; FAQ.tsx:8 is the only hint
- **Evidence:** A voter learns after the fact that a nullified ballot cannot be replaced.
- **Change:** State it in the dialog: “After nullifying you cannot cast a new ballot in this election.”
- **Status:** Resolved in Phase F (nullification)

### UX-017 · High · Duration and CPU cost are not disclosed before starting; the progress dialog cannot be dismissed

- **Where:** KAnonymityProgressDialog.tsx:24-27 (no onOpenChange, Escape not blocked, inherited close button does nothing); :71 “Do not close this window” appears only after start
- **Evidence:** Six Groth16 proofs can take long on a phone. The user is trapped in a modal with a non-functional close control and no cancel.
- **Change:** Pre-flight line “This takes about N seconds and keeps this tab busy”; hide the close button for this dialog; provide Cancel via AbortSignal or a timeout message.
- **Status:** Resolved in Phase F (nullification)

### UX-018 · High · Progress strings are developer messages

- **Where:** kAnonymityNullificationService.ts:133,219,228,238 rendered by KAnonymityProgressDialog.tsx:52; nullificationFlow.ts:77 “Another participant updated a slot; regenerating proofs…”
- **Evidence:** “Computing XOR gate outputs…”, “Generating 6 zero-knowledge proofs in parallel…”, “All proofs generated successfully!”
- **Change:** Map to voter language: “Preparing your request (3 of 6)”, “Someone else submitted at the same time, retrying”.
- **Status:** Resolved in Phase F (nullification)

### UX-019 · High · Nothing on the page changes after a request, and nothing explains why

- **Where:** ElectionDetail.tsx after submit (screenshot 34); toast only
- **Evidence:** The deliberate neutrality looks like a failed action. Repeated submissions are allowed but never mentioned.
- **Change:** Neutral confirmation panel: “Your request was submitted. This page will not change, by design. You may submit as many requests as you like until the election closes.”
- **Status:** Resolved in Phase F (nullification)

### UX-020 · High · Coerced-voter guidance is absent

- **Where:** No page says when (before close), where (a device the coercer cannot see) or what happens next
- **Evidence:** The flow assumes the voter already understands the threat model.
- **Change:** Add a short “If you were pressured” section on the election page and in How Votex works.
- **Status:** Resolved in Phase F (nullification)

### UX-021 · Medium · Nullification window closes silently

- **Where:** ElectionDetail.tsx:588 hides the panel on close
- **Evidence:** A voter returning after close sees no explanation.
- **Change:** Show “Nullification closed with the election on ”.
- **Status:** Resolved in Phase F (nullification)

### UX-022 · Medium · “Type-0 protocol” caption on both cards

- **Where:** NullificationDialog.tsx:62,80
- **Evidence:** Meaningless to voters and identical on both options.
- **Change:** Delete.
- **Status:** Resolved in Phase F (nullification)

### UX-023 · Medium · Jargon in the sidebar: “Adaptive k-anonymity (up to k=6)”, “Zero-Knowledge Proofs”

- **Where:** ElectionDetail.tsx:768-781; the 6 is hard-coded while DEFAULT_K exists
- **Evidence:** Voters do not know what k is; the number can drift from the constant.
- **Change:** “Your request is hidden among up to {DEFAULT_K} participants”; move cryptographic detail to the audit page.
- **Status:** Resolved in Phase F (nullification)

### UX-024 · Medium · Toast reports “hidden across 1 participant slots” for tiny elections

- **Where:** ElectionDetail.tsx:460
- **Evidence:** Plural error and a false privacy claim when k=1 (the progress dialog already handles this honestly).
- **Change:** Pluralise and say “no other participants yet; this request is not hidden” when the count is 1.
- **Status:** Resolved in Phase F (nullification)


## Voting and delegation (13)

_The ballot panel, option selection, delegation dialog and their states._

### UX-025 · High · Ballot options have no selection semantics

- **Where:** ElectionDetail.tsx:651-679
- **Evidence:** Toggle buttons whose selected state is colour-only; no aria-pressed or radio roles; an h3 inside each button makes its accessible name “Option A Approve… Current support 0% 0 verified votes”.
- **Change:** Use the existing RadioGroup (radiogroup/radio/aria-checked) with a visible check mark; move the heading out of the button.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-026 · High · Casting a public, irreversible ballot happens on a single click

- **Where:** ElectionDetail.tsx:704
- **Evidence:** No confirmation names the choice before it is signed and published.
- **Change:** Confirm step: “Publish ‘Approve the irrigation project’ under your pseudonym? This cannot be undone.”
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-027 · High · Registration happens invisibly inside the vote and delegate actions

- **Where:** ElectionDetail.tsx:352; DelegationDialog.tsx:63-70 then speaks of “registered participants”
- **Evidence:** Voters never asked to register and then see a term they do not recognise. Participants count jumps from 1 to 6 after a vote with no explanation (screenshot 29).
- **Change:** Explain once: “Casting or delegating registers your voting key for this election.”
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-028 · High · Delegation target is an unstable, anonymous “Participant #N”

- **Where:** DelegationDialog.tsx:42-47,94-95
- **Evidence:** N is a position in a joined_at-sorted list that shifts as people join, and only prior voters appear. The dialog also offered the voter themself as the only option (screenshot 24).
- **Change:** Delegate by pasted pseudonym (shown on the delegate's profile), exclude self, and show the stable pseudonym instead of an index.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-029 · High · Revoke delegation fails silently and can double-fire

- **Where:** ElectionDetail.tsx:105-115; delegationService.ts revokeDelegation returns false with no message
- **Evidence:** No toast, no busy state, no confirm.
- **Change:** Busy state, failure toast, and a confirm since it changes how the ballot counts.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-030 · Medium · “Cast vote” is disabled with no reason shown

- **Where:** ElectionDetail.tsx:705 (needsKeypair or no selection); screenshot 23
- **Evidence:** The explanation (“Unlock your ballot key”) is in a separate panel above.
- **Change:** Keep the button enabled and validate on click, or add helper text under it (“Select an option” / “Unlock your passkey first”).
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-031 · Medium · Live percentages shown on options before the voter decides

- **Where:** ElectionDetail.tsx:665-666 (“Current support 62%”)
- **Evidence:** Bandwagon pressure inside the ballot itself. The running tally is a stated design choice, but it need not sit on the option buttons.
- **Change:** Show the distribution after the voter casts, or in the sidebar, not on the options.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-032 · Medium · Option cards misalign when titles wrap

- **Where:** ElectionDetail.tsx:651-679 (screenshot 23: Option A two lines, Option B one line)
- **Evidence:** “Current support” rows sit at different heights across the pair.
- **Change:** Make the cards a grid with the stats row pinned to the bottom.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-033 · Medium · Percentage rounding differs between list and detail

- **Where:** Elections.tsx:220 forces 100%; ElectionDetail.tsx:476-477 rounds independently
- **Evidence:** Can show 50%/50% for a 1-vs-2 split on the detail page.
- **Change:** One shared formatter that distributes rounding.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-034 · Medium · Tie state has no treatment

- **Where:** ElectionDetail.tsx:599,623
- **Evidence:** No winner badge and no copy when counts are equal.
- **Change:** Show “Tie” explicitly.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-035 · Medium · Delegation weights are never shown to anyone

- **Where:** Public results, tally table and receipt never display weight
- **Evidence:** A delegate's ballot counts for more than one and nobody can see it.
- **Change:** Show weight in the tally table and a “weighted” note on results.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-036 · Low · Self-delegation, delegation to a non-voter and chained delegation all silently become weight zero

- **Where:** delegationDecoding.ts (self rejected at tally), DelegationDialog.tsx:42-47 (client-only exclusion)
- **Evidence:** The voter is not warned before choosing.
- **Change:** Block self in the dialog and explain the chain rule in its description.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-037 · Low · “Vote cast successfully” says nothing about what comes next

- **Where:** ElectionDetail.tsx:370-371
- **Evidence:** No pointer to the receipt or to the nullification window.
- **Change:** “Ballot recorded. Your receipt is below. You can nullify it any time before .”
- **Status:** Resolved in Phase E (election detail, voting, delegation)


## Sign-in and session (14)

_Passkey and World ID onboarding, session lifetime, logout._

### UX-038 · High · Two primary-looking choices on the sign-in card

- **Where:** WorldIDSignIn.tsx:352-379 (screenshot 11)
- **Evidence:** “Use an Existing Votex Passkey” is the filled primary above “Create a New Votex Passkey”; first-time users must notice the divider “First time here?”.
- **Change:** One primary “Continue with passkey” that opens the native picker, plus a text link “I don't have a Votex passkey yet”.
- **Status:** Resolved in Phase C (sign-in and session)

### UX-039 · High · RP signature failure leaves “Initializing…” forever

- **Where:** WorldIDSignIn.tsx:86-113 (error only logged); :473-481
- **Evidence:** If the rp-signature call fails, step 2 never becomes available and there is no retry.
- **Change:** Render an error state with Retry.
- **Status:** Resolved in Phase C (sign-in and session)

### UX-040 · High · World ID and passkey errors surface as raw codes

- **Where:** WorldIDSignIn.tsx:290-294 (IDKit code), :182-187 (DOMException text), passkeyService.ts:205-208 (“PRF/hmac-secret extension”)
- **Evidence:** Voters see “verification_rejected” or “NotAllowedError”.
- **Change:** Map codes to sentences, e.g. “This passkey type can't be used for Votex. Try one stored in iCloud Keychain, Google Password Manager, or a security key that supports hmac-secret.”
- **Status:** Resolved in Phase C (sign-in and session)

### UX-041 · High · Sign-out is an icon-only header button; nothing on the profile page

- **Where:** NavBar.tsx:103-111 (h-10, no visible label); Dashboard.tsx
- **Evidence:** Hard to find, easy to hit by accident, no confirmation.
- **Change:** Add a labelled “Sign out” on the profile; keep the header icon with a tooltip and a confirm.
- **Status:** Resolved in Phase C (sign-in and session)

### UX-042 · High · Session expiry is silent

- **Where:** WalletContext.tsx:69-71 flips to unverified without a message
- **Evidence:** A voter mid-flow gets whatever the server error says.
- **Change:** Toast “Your session expired. Sign in again” and preserve a return path (?next=).
- **Status:** Resolved in Phase C (sign-in and session)

### UX-043 · Medium · Three different post-sign-in landings

- **Where:** WorldIDSignIn.tsx:265 (new: /success then auto /elections), returning: /elections, home CTA: /dashboard
- **Evidence:** Inconsistent and the Success page is a third confirmation after the step state and a toast.
- **Change:** Land everyone on /elections with a one-line welcome banner; retire /success.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-044 · Medium · Success page auto-redirects after 4.5 s with no indication or way to pause

- **Where:** Success.tsx:16-19
- **Evidence:** Fails WCAG 2.2.1 timing; users reading the card get yanked away.
- **Change:** Remove the timer; the Continue button already exists.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-045 · Medium · Status messages are rendered as disabled buttons

- **Where:** WorldIDSignIn.tsx:386-404,485-494,503-512 (“Passkey Ready”, “Binding identity…”)
- **Evidence:** Not actions, skipped by screen readers, state changes unannounced.
- **Change:** Render as role=status text; keep buttons for actions only.
- **Status:** Resolved in Phase C (sign-in and session)

### UX-046 · Medium · Step 2 panel dimmed to roughly 2.9:1 before the passkey step

- **Where:** WorldIDSignIn.tsx:412-419 opacity-60 on the whole section
- **Evidence:** Explanatory text becomes unreadable for low-vision users.
- **Change:** Dim only the control; keep text at full opacity and mark the step aria-disabled.
- **Status:** Resolved in Phase C (sign-in and session)

### UX-047 · Medium · Watermark fingerprint overlaps the step-1 text

- **Where:** WorldIDSignIn.tsx:331-333 (screenshot 11/12)
- **Evidence:** “originally registered.” runs into the decorative icon on desktop.
- **Change:** Reserve right padding for the watermark or drop it.
- **Status:** Resolved in Phase C (sign-in and session)

### UX-048 · Medium · New tab or refresh asks the voter to “Unlock Passkey” again with no explanation

- **Where:** ElectionDetail.tsx:571-586; keypair lives in sessionStorage per tab
- **Evidence:** Looks like a lost session.
- **Change:** Add “Your voting key is kept per tab for safety; unlock to continue.”
- **Status:** Resolved in Phase C (sign-in and session)

### UX-049 · Medium · Key-conflict recovery dead-ends

- **Where:** WorldIDSignIn.tsx:276-278 hides the create button and offers only Support
- **Evidence:** A voter who truly lost their passkey has no path.
- **Change:** Offer the documented recovery path or a clear “contact support with this code”.
- **Status:** Resolved in Phase C (sign-in and session)

### UX-050 · Low · Header shows “Sign In” link while on the sign-in page

- **Where:** NavBar.tsx:113-116 on /dashboard (screenshot 11)
- **Evidence:** Self-referential.
- **Change:** Hide or mark current.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-051 · Low · 1.2 s delay before redirect after “Identity Confirmed” with nothing indicating it

- **Where:** WorldIDSignIn.tsx:264-266
- **Evidence:** Feels like a stall.
- **Change:** Redirect immediately or show the Continue button only.
- **Status:** Resolved in Phase B (routes and navigation)


## Elections list and creation (15)

_The browser, filters, the inline composer and the edit form._

### UX-052 · High · Edit form writes UTC into a datetime-local input, shifting the deadline on save

- **Where:** ElectionEditForm.tsx:52 (toISOString().slice(0,16))
- **Evidence:** The prefilled time differs from the “Current end date” box beside it by the UTC offset; saving any field rewrites the deadline.
- **Change:** Format with a local formatter (date-fns format “yyyy-MM-dd'T'HH:mm”).
- **Status:** Resolved in Phase D (elections list and creation)

### UX-053 · High · Deadline input has no label, no minimum, no default and no timezone hint

- **Where:** ElectionForm.tsx:101; ElectionEditForm.tsx:218-224; axe: label (critical)
- **Evidence:** Empty submit shows the zod default “Invalid date” (screenshot 18). Past dates are accepted until submit.
- **Change:** Label “Closing date and time”, min = now, default +7 days, “Times are in your local timezone (UTC±X)”.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-054 · High · Validation errors are not associated with their fields

- **Where:** ElectionForm.tsx:54-102; ElectionEditForm.tsx:151-227
- **Evidence:** No aria-invalid, aria-describedby or live region; screen-reader users get focus but no message. No required markers or length counters for the 100/500/50 limits.
- **Change:** Wire aria-invalid and aria-describedby; add required indicators and counters.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-055 · High · No duplicate-option check

- **Where:** ElectionForm/schema.ts; ElectionDetail.tsx:596-602 keys on option text
- **Evidence:** “Yes”/“Yes” or “Yes”/“ Yes” publishes and breaks counting keys.
- **Change:** Refine: trimmed, case-insensitive options must differ.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-056 · Medium · Empty state reads as a failed search even when nothing exists

- **Where:** Elections.tsx:207-213 (“No elections found / Try another search”, “Show All Elections” while All is active; screenshot 7/16)
- **Evidence:** Misleading for a fresh deployment; the reset button is a no-op.
- **Change:** Branch on “no elections yet” vs “no matches”; hide the reset when no filter is active.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-057 · Medium · “Create Election” toggles an inline composer; “Close Composer” discards without confirm and uses a plus icon

- **Where:** Elections.tsx:151-154 (screenshot 18)
- **Evidence:** Button lacks aria-expanded; focus is not moved into the form; the icon contradicts the action.
- **Change:** Move to a dialog or dedicated route; add aria-expanded; confirm discard; swap the icon.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-058 · Medium · Only entry point into an election is a small text button

- **Where:** Elections.tsx:268-275 (“Vote” / “Results”, ~20 px tall)
- **Evidence:** Card and title are not links.
- **Change:** Make the title a stretched link; keep the explicit CTA with a 44 px target.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-059 · Medium · Sort select loses its label on phones

- **Where:** Elections.tsx:192-202 (“Sort” is hidden sm:inline); axe: select-name (critical)
- **Evidence:** display:none removes the accessible name.
- **Change:** Use sr-only sm:not-sr-only.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-060 · Medium · Load error and empty state render together, plus a toast

- **Where:** Elections.tsx:56-63,127-133,207-213
- **Evidence:** Three messages for one failure.
- **Change:** Show one inline error with Retry; suppress the empty state when isError.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-061 · Medium · Pagination loses focus and does not scroll

- **Where:** Elections.tsx:284-305 (Next becomes disabled while focused; indicator not live)
- **Evidence:** Keyboard users land on body on the last page.
- **Change:** aria-disabled, aria-live on the indicator, scroll to the list heading on change.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-062 · Medium · Election cards show “4 years” with no absolute date; closed cards show a bare “10/17/2026”

- **Where:** Elections.tsx:264-265 (screenshots 21, 54)
- **Evidence:** Ambiguous day/month order and no time or zone.
- **Change:** One date formatter with absolute local time, zone and a  element; relative time as a secondary label.
- **Status:** Resolved in Phase A (foundations)

### UX-063 · Medium · Placeholders for options never render

- **Where:** ElectionForm.tsx:75,83 (“Approve Bond”/“Decline Bond”) with defaults “Yes”/“No”
- **Evidence:** Dead copy.
- **Change:** Drop the defaults or the placeholders.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-064 · Low · Dead unsafe-edit branch in the edit form

- **Where:** ElectionEditForm.tsx:65-73,128-142,180,195; parent mounts the form only when safeToEdit
- **Evidence:** Window.confirm, red warning and locked inputs can never show, and their copy contradicts the dashboard.
- **Change:** Delete the branch.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-065 · Low · “Unsaved changes will be recorded in the audit trail”

- **Where:** ElectionEditForm.tsx:245
- **Evidence:** States the opposite of what happens.
- **Change:** “Saving records this change in the audit trail.”
- **Status:** Resolved in Phase D (elections list and creation)

### UX-066 · Low · “1 elections”, “1 votes”

- **Where:** Elections.tsx:190,234 (screenshots 20, 54)
- **Evidence:** Plural bug.
- **Change:** Shared plural helper.
- **Status:** Resolved in Phase A (foundations)


## Receipts and audit ledger (12)

_Receipt card, receipt page, and the public tables under each election._

### UX-067 · High · “Verify Receipt” is circular

- **Where:** VoteReceiptCard.tsx:99 links to /receipts/:id, which renders the same card with the same precomputed badge (screenshot 30)
- **Evidence:** The button promises a check and performs none the user can see.
- **Change:** Explain what was checked (“the signature matches the key registered for this pseudonym”) and offer offline verification by pasting a receipt; hide the button on the receipt page.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-068 · High · “Signature Not Verified” in error red for a missing key as well as an invalid one

- **Where:** VoteReceiptCard.tsx:39-42; VoteReceipt.tsx:45-58
- **Evidence:** Alarms users when the participant key simply has not loaded.
- **Change:** Distinguish “Could not verify yet” from “Invalid signature”.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-069 · Medium · Raw serialised signature JSON shown to voters

- **Where:** VoteReceiptCard.tsx:88 (screenshot 29)
- **Evidence:** A 400-digit blob under “Ledger data”.
- **Change:** Collapse behind “Show technical details”.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-070 · Medium · Truncated identifiers in the ledger tables cannot be read or copied

- **Where:** ElectionPublicAudit.tsx:168,176,177,184 (“e2e-vote…seudonym”, screenshot 36/37)
- **Evidence:** The tables exist so people can verify identifiers.
- **Change:** Show full values on hover/expand with a copy control; truncate in the middle only with a title attribute.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-071 · Medium · Hand-rolled tabs without tab semantics or keyboard support

- **Where:** ElectionPublicAudit.tsx:122-140
- **Evidence:** role=tab with no aria-controls, no tabpanel, no arrow keys; ~30 px tall.
- **Change:** Use the Radix Tabs already in the project.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-072 · Medium · Audit trail shows raw action strings and an unexplained “Record” column

- **Where:** ElectionPublicAudit.tsx:87-93,180-186 (screenshot 37)
- **Evidence:** “Nullification proof accepted” rows with a bare hash; no legend.
- **Change:** Human labels, a legend row, and a one-sentence explanation per tab.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-073 · Medium · Receipt timestamps lack timezone and  markup

- **Where:** VoteReceiptCard.tsx:81,85; ElectionPublicAudit.tsx:34
- **Evidence:** “10/17/2026, 5:58:36 PM” is locale-ambiguous.
- **Change:** Shared date formatter with zone.
- **Status:** Resolved in Phase A (foundations)

### UX-074 · Medium · “Load 25 More” unmounts while loading, losing focus

- **Where:** ElectionPublicAudit.tsx:192-194
- **Evidence:** Keyboard focus drops to body on every page load.
- **Change:** Keep mounted, set aria-busy.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-075 · Medium · Receipt page reports any fetch error as “No public ballot matches this receipt ID”

- **Where:** VoteReceipt.tsx:26-30,100-104 (screenshot 9)
- **Evidence:** Network failures look like a bad receipt.
- **Change:** Separate error from not-found; add Retry.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-076 · Low · Copy icon copies the whole JSON while sitting next to the fingerprint

- **Where:** VoteReceiptCard.tsx:48-53
- **Evidence:** Mismatch between the visual target and what is copied.
- **Change:** Copy the fingerprint there; keep “Copy Receipt JSON” in Actions.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-077 · Low · External-link icon on an internal link

- **Where:** VoteReceiptCard.tsx:61
- **Evidence:** Wrong affordance.
- **Change:** Remove the icon.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-078 · Low · Receipt card can show “Election” as the title

- **Where:** ElectionDetail.tsx:244 fallback when election has not loaded
- **Evidence:** Placeholder leaks.
- **Change:** Wait for the election or hide the field.
- **Status:** Resolved in Phase G (receipts and public records)


## Authority console (18)

_Operator sign-in, election list, dashboard, close, tally and results._

### UX-079 · High · Tally success view and “Start Replacement Tally” vanish immediately after success

- **Where:** ElectionAuthorityDashboard.tsx:162-164,305-312; ElectionAuthorityInterface.tsx:88-179 (screenshot 46 shows the Overview tab instead)
- **Evidence:** onTallyComplete bumps refreshKey, the Process Tally tab becomes “already processed”, and the results summary with the invalid-delegation warning unmounts before the operator can read it.
- **Change:** Keep the result panel mounted; move replacement into the dashboard.
- **Status:** Resolved in Phase H (authority console)

### UX-080 · High · Close Election Early is a destructive action styled as primary and confirmed by window.confirm

- **Where:** ElectionAuthorityDashboard.tsx:131,224
- **Evidence:** The confirm does not mention that voters lose the nullification window.
- **Change:** Destructive variant plus an accessible AlertDialog naming the consequence.
- **Status:** Resolved in Phase H (authority console)

### UX-081 · High · Tally errors swallow the secret; no progress during processing

- **Where:** ElectionAuthorityInterface.tsx:84 clears the field in finally; :240-257 no status
- **Evidence:** A typo means retyping a 256-bit key; long runs show only a spinning calculator icon.
- **Change:** Keep the value on recoverable errors; show live status text.
- **Status:** Resolved in Phase H (authority console)

### UX-082 · High · Chart has no legend, no text alternative and low-contrast ticks

- **Where:** TallyResultsChart.tsx; Y ticks #74777d on #eff4ff (4.07:1); screenshot 42
- **Evidence:** Two bar series are indistinguishable without the hover tooltip.
- **Change:** Add Legend and accessibilityLayer, darken ticks, aria-label the chart (the numbers already appear beside it).
- **Status:** Resolved in Phase H (authority console)

### UX-083 · High · Results tab shows “Final” series and “0 tracked ballots were removed from the final outcome” before any tally

- **Where:** TallyResultsDisplay.tsx:109,148,256 (screenshot 42 with “Vote Tracking Active”)
- **Evidence:** Final and preliminary are presented as both available at once.
- **Change:** Hide the Final series until a tally run exists.
- **Status:** Resolved in Phase H (authority console)

### UX-084 · Medium · Deep link /elections/:id/authority ignores the id

- **Where:** App.tsx:95; ElectionAuthority.tsx:141-249 never reads useParams
- **Evidence:** Lands on the list instead of the election; views are not URL-addressable so Back does nothing.
- **Change:** Read the id, preselect, reflect view in the URL; rename to /authority/elections/:id.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-085 · Medium · Sign-in hint mentions a recovery key on a screen that has no such field

- **Where:** ElectionAuthorityLogin.tsx (screenshot 39: “Use only the generated 256-bit recovery key…” under email/password)
- **Evidence:** Operator jargon (“BabyJubJub key”) and a hint for a different mode.
- **Change:** Show the hint only in link mode; plain language.
- **Status:** Resolved in Phase H (authority console)

### UX-086 · Medium · Stat tiles are mostly constants before tally

- **Where:** ElectionAuthorityDashboard.tsx:231-258 (“2 Voting options”, “0 Tallied voters”, “Live”)
- **Evidence:** Four large numbers that carry almost no information; “Secure session active” occupies the slot where election status belongs.
- **Change:** Show votes, participants, delegations, nullification requests; move session state to the sidebar.
- **Status:** Resolved in Phase H (authority console)

### UX-087 · Medium · “Pending Tally” rendered in error red for every active election

- **Where:** AuthorityElectionsList.tsx:177-179 (screenshot 41)
- **Evidence:** Tallying an active election is impossible, so the alarm is permanent.
- **Change:** Neutral “Not yet tallied” for active, red only when closed and untallied.
- **Status:** Resolved in Phase H (authority console)

### UX-088 · Medium · “Nullification Events” counts decoys

- **Where:** TallyResultsDisplay.tsx:178 (screenshot 46: 6 events, 0 nullified)
- **Evidence:** Reads as six real nullifications.
- **Change:** Label “Nullification requests (incl. decoys)” and show it next to the resolved count with a one-line explanation.
- **Status:** Resolved in Phase H (authority console)

### UX-089 · Medium · Processed-voter table truncates silently

- **Where:** TallyResultsDisplay.tsx:284,298 (slice(0,12), “Showing the latest processed tally entries”)
- **Evidence:** No “12 of N” and no way to see the rest.
- **Change:** Paginate or export; show the total.
- **Status:** Resolved in Phase H (authority console)

### UX-090 · Medium · Secret and password fields have no show/hide and incomplete autocomplete attributes

- **Where:** ElectionAuthorityLogin.tsx:176,184,196; ElectionAuthorityInterface.tsx:222-232
- **Evidence:** Typing a 64-hex key blind is error-prone; email lacks autoComplete and inputMode.
- **Change:** Add reveal toggles; autoComplete email/current-password/new-password.
- **Status:** Resolved in Phase H (authority console)

### UX-091 · Medium · Login error is both toasted and inline, without alert semantics

- **Where:** ElectionAuthorityLogin.tsx:125-132,201-208
- **Evidence:** Duplicate announcement for screen readers, none for the inline block.
- **Change:** Inline role=alert only; aria-invalid on fields.
- **Status:** Resolved in Phase H (authority console)

### UX-092 · Medium · No way back to the public site from the console

- **Where:** NavBar and Footer hidden on authority routes; sidebar has no home link
- **Evidence:** Operators are stranded.
- **Change:** Add “Back to Votex” in the sidebar.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-093 · Medium · Audit log prints raw action identifiers and “Performed by ”

- **Where:** AuthorityAuditLog.tsx:69-70
- **Evidence:** Not readable by a human reviewer.
- **Change:** Map actions to labels; show the operator's display name.
- **Status:** Resolved in Phase H (authority console)

### UX-094 · Low · Odd spinners

- **Where:** ElectionAuthorityDashboard.tsx:225 (TrendingUp spins), ElectionAuthorityInterface.tsx:248 (Calculator spins), ElectionEditForm.tsx:252 (Save spins)
- **Evidence:** Rotating semantic icons look broken.
- **Change:** Use Loader2 everywhere.
- **Status:** Resolved in Phase H (authority console)

### UX-095 · Low · “Completed on … by Election Authority” is a literal string

- **Where:** ElectionAuthorityInterface.tsx:63
- **Evidence:** Not the operator's identity.
- **Change:** Use the signed-in account.
- **Status:** Resolved in Phase H (authority console)

### UX-096 · Low · “by Manage Dashboard” buttons lack per-row context

- **Where:** AuthorityElectionsList.tsx:188-194
- **Evidence:** Identical names for screen readers.
- **Change:** aria-label with the election title; relabel “Open”.
- **Status:** Resolved in Phase H (authority console)


## Navigation and information architecture (9)

_Routes, menus, page purposes and how they connect._

### UX-097 · High · /dashboard is the sign-in page and is labelled eight different ways

- **Where:** NavBar.tsx:30 (Profile), :115 (Sign In), :102 (Verified Human); Index.tsx:43,153; NotFound.tsx:24 (Back to Identity); Elections.tsx:157 (Verify to Create); ElectionDetail.tsx:723 (Verify Identity First)
- **Evidence:** The same route is a sign-in for some users and a profile for others.
- **Change:** Split into /sign-in and /profile; use “Sign in” and “Profile” consistently.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-098 · High · Desktop and mobile navigation expose different pages

- **Where:** NavBar.tsx:14-34 (Home/Vote/Audit/Profile) vs :70-72 (Elections/How It Works/FAQ); footer has neither FAQ nor How It Works
- **Evidence:** How It Works and FAQ are unreachable on phones; Audit Protocol is footer-only on desktop; “Vote” and “Elections” name the same route.
- **Change:** One navigation model; add FAQ and How Votex works to the footer.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-099 · Medium · Four overlapping explainer pages, two of them stubs

- **Where:** Index.tsx, HowItWorks.tsx, FAQ.tsx, Privacy.tsx (16 lines), AuditProtocol.tsx (18 lines); dangling references at FAQ.tsx:51 and AuditProtocol.tsx:14
- **Evidence:** The same four facts repeat; the honest caveats live on the least-linked page.
- **Change:** One “How Votex works” page with anchored sections; FAQ keeps true FAQs; link Privacy from the ballot panel.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-100 · Medium · “Operator Entrance” in the public footer

- **Where:** AppFooter.tsx:26
- **Evidence:** Odd label; exposes the admin login to every voter.
- **Change:** “Election Authority sign-in”, or move it to the audit page.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-101 · Medium · Route naming inconsistency

- **Where:** App.tsx:104-105 (/election_authority vs /elections/:id/authority)
- **Evidence:** Underscore vs hyphen; detection relies on both string shapes.
- **Change:** /authority and /authority/elections/:id.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-102 · Medium · Navigation implemented with buttons instead of links

- **Where:** Dashboard.tsx:53,122,143; Elections.tsx:156,270; ElectionDetail.tsx:503,519,721; Success.tsx:39
- **Evidence:** No middle-click, new tab or link semantics.
- **Change:** Use Link.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-103 · Medium · 404 page copy and CTA mislead

- **Where:** NotFound.tsx:15-25 (“This ledger entry does not exist”, “Back to Identity”, “authenticated dashboard” for signed-out users; screenshot 6)
- **Evidence:** Jargon and a primary CTA to the sign-in page.
- **Change:** “Page not found”, “Go to elections”, “Go home”.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-104 · Low · Dead ternary on the home CTA

- **Where:** Index.tsx:42 (isWorldIDVerified ? "/dashboard" : "/dashboard")
- **Evidence:** Both branches identical; the signed-in label “Open Voting Profile” goes to the sign-in route.
- **Change:** Point signed-in users at /profile.
- **Status:** Resolved in Phase B (routes and navigation)

### UX-105 · Low · Home search box duplicates the header search and lands on the All filter

- **Where:** Index.tsx:64; Elections.tsx:50
- **Evidence:** Two searches with different placeholders.
- **Change:** Keep one; make “Browse Active Elections” apply the Active filter.
- **Status:** Resolved in Phase B (routes and navigation)


## Feedback and states (11)

_Toasts, loading, empty, error and offline behaviour._

### UX-106 · High · “Authentication loaded / Your human identity has been restored” fires on every page load

- **Where:** WalletContext.tsx:65-68 (visible in 20 of 54 screenshots)
- **Evidence:** Permanent noise that trains users to ignore toasts.
- **Change:** Remove; show identity state in the header only.
- **Status:** Resolved in Phase A (foundations)

### UX-107 · High · Error toasts auto-dismiss in five seconds and old ones stack

- **Where:** ui/toast.tsx default duration; screenshots 45/46 show a stale “Tally processing failed” beside “Tally processed”
- **Evidence:** Failures vanish before they can be read; superseded errors linger.
- **Change:** Persistent destructive toasts; dismiss earlier toasts of the same action on success.
- **Status:** Resolved in Phase A (foundations)

### UX-108 · High · Silent data failures

- **Where:** TallyResultsDisplay.tsx:56-73 (no catch, shows zeros); ElectionDetail.tsx:254-258 (vote status error shows the ballot UI); :62-66 (delegation status); ElectionAuthorityDashboard.tsx:79-82,118-121; ElectionAuthority.tsx:152-167
- **Evidence:** The UI presents wrong-but-plausible state when a request fails.
- **Change:** Explicit error states with Retry everywhere a read feeds a decision.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-109 · High · Toast close button has no accessible name and is invisible until hover

- **Where:** ui/toast.tsx:72-86 (axe button-name, critical, 31 steps); :79 opacity-0
- **Evidence:** Screen-reader users hear nothing; touch users cannot dismiss.
- **Change:** Add sr-only “Dismiss”; always visible.
- **Status:** Resolved in Phase A (foundations)

### UX-110 · Medium · Any election fetch error becomes “Election not found” plus a duplicate toast

- **Where:** ElectionDetail.tsx:195-200,494-511 (screenshot 8)
- **Evidence:** Network errors look like deleted elections; two messages for one event.
- **Change:** Separate not-found from error; one inline message with Retry.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-111 · Medium · Five different loading phrasings and components

- **Where:** App.tsx:40, ProtectedRoute.tsx:18, ElectionAuthority.tsx:40,206, ElectionAuthorityDashboard.tsx:37, bare spinners in Dashboard.tsx:28 and VoteReceipt.tsx:96, skeletons elsewhere; none have role=status
- **Evidence:** Inconsistent and silent for assistive tech.
- **Change:** Skeletons for pages, one inline spinner component, role=status with text.
- **Status:** Resolved in Phase A (foundations)

### UX-112 · Medium · In-progress buttons use disabled

- **Where:** ui/button.tsx:9 with ~12 call sites (“Recording vote…”, “Unlock Passkey”, “Begin Tally Processing”)
- **Evidence:** Removed from tab order, dimmed to 2.4:1, no aria-busy.
- **Change:** aria-disabled plus aria-busy; keep opacity; reserve disabled for truly unavailable actions.
- **Status:** Resolved in Phase A (foundations)

### UX-113 · Medium · Scary sign-out failure toast

- **Where:** WalletContext.tsx:123-127 (“Retry from a trusted device before assuming copied sessions are invalid”)
- **Evidence:** Threat-model language aimed at a voter.
- **Change:** “We couldn't confirm sign-out with the server. Sign out again when you are back online.”

### UX-114 · Medium · Offline banner promises “write actions will fail safely”; nothing announces reconnection

- **Where:** ConnectivityBanner.tsx:23
- **Evidence:** Unverifiable claim.
- **Change:** “You can't vote or nullify while offline”; brief “Back online” status.

### UX-115 · Medium · “Election published” keeps the user on the list

- **Where:** Elections.tsx:68 (screenshot 20)
- **Evidence:** The new election appears as a card with a toast; the natural next step (open it, share it) is not offered.
- **Change:** Navigate to the new election, or add “Open” to the toast.
- **Status:** Resolved in Phase D (elections list and creation)

### UX-116 · Low · Redundant success toasts

- **Where:** “Secure session restored”, “Passkey unlocked” (duplicates panel copy), “Vote delegated” (duplicates the banner), “Logged out”
- **Evidence:** Toast per state change regardless of visible feedback.
- **Change:** Toast only when nothing else on screen confirms the result.
- **Status:** Resolved in Phase A (foundations)


## Accessibility (15)

_Semantics, keyboard, focus, contrast, motion, targets._

### UX-117 · High · No focus management after dialogs close or actions complete

- **Where:** Observed: focus on  after sign-in completion, after casting, after delegating, after nullifying, after sign-out (records.json)
- **Evidence:** Keyboard and screen-reader users lose their place after every major action.
- **Change:** Move focus to the result heading or region after each action; return focus to the trigger when dialogs close.
- **Status:** Resolved in Phase A (foundations)

### UX-118 · High · No skip link, no scroll reset or focus move on route change

- **Where:** App.tsx:82-107; index.html
- **Evidence:** Navigating from the bottom of a list keeps the scroll offset; nothing lets keyboard users skip the header.
- **Change:** Skip-to-content link; scrollTo(0,0) and focus main on location change.
- **Status:** Resolved in Phase A (foundations)

### UX-119 · High · Contrast failures on labels, placeholders, dark-panel eyebrows and chart ticks

- **Where:** ui/input.tsx:12, ui/textarea.tsx:14 (placeholder 4.06:1); text-outline on white 4.48:1 and on surface-container-low 4.06:1 (NullificationDialog.tsx:61,79, WorldIDSignIn.tsx:366,406,529, TallyResultsDisplay.tsx:290, AuthorityElectionsList.tsx:146); axe color-contrast on 12 steps
- **Evidence:** Below WCAG AA for body-size text.
- **Change:** Use on-surface-variant for secondary text; darken ticks; audit every text-outline use.

### UX-120 · High · Sub-12 px text in 24 places and roughly 15 touch targets under 44 px

- **Where:** text-[10px]: NavBar.tsx:133, Elections.tsx:228, Dashboard.tsx:88, TallyResultsDisplay.tsx:309, AuthorityElectionsList.tsx:167, ElectionAuthority.tsx:58,126,133; text-[11px]: 14 sites; targets: NavBar sign-out/Sign In (40 px), mobile tabs (~40 px), dialog close (16 px), copy icons (16 px), filter and pagination buttons, audit tabs, size="sm" buttons
- **Evidence:** Fails readability and mobile tap guidance.
- **Change:** Floor at text-xs; min 44 px targets.

### UX-121 · High · Authority console has nested main landmarks and two h1s per view

- **Where:** ElectionAuthority.tsx:115 (main inside App's main), :67 (brand h1) plus each pane's h1; axe moderate on 9 steps; sidebar nav lacks aria-label and aria-current
- **Evidence:** Landmark navigation is broken for screen-reader users.
- **Change:** Render the console outside App's main or as divs; brand as p; aria-current on nav items.
- **Status:** Resolved in Phase H (authority console)

### UX-122 · Medium · Progress dialog has no progressbar role, no live region, and shows NaN% when total is 0

- **Where:** KAnonymityProgressDialog.tsx:20,52-60
- **Evidence:** Long operation is silent to assistive tech.
- **Change:** role=progressbar with aria-valuenow; throttled aria-live message; guard the division.
- **Status:** Resolved in Phase F (nullification)

### UX-123 · Medium · Dialog titles are duplicated for screen readers

- **Where:** NullificationDialog.tsx:28-32,40-43; KAnonymityProgressDialog.tsx:29-31,38
- **Evidence:** sr-only DialogTitle plus a visible h2 with the same text.
- **Change:** Make the visible heading the DialogTitle.
- **Status:** Resolved in Phase F (nullification)

### UX-124 · Medium · Tables lack scope and captions; scrollable regions not keyboard-focusable on phones

- **Where:** ElectionPublicAudit.tsx:155-162; AuthorityElectionsList.tsx:146-153; TallyResultsDisplay.tsx:289-321; axe scrollable-region-focusable
- **Evidence:** Column headers are not announced; horizontal scroll is mouse-only.
- **Change:** th scope=col, caption, tabIndex=0 on the scroll container.
- **Status:** Resolved in Phase G (receipts and public records)

### UX-125 · Medium · Footer aria-labels override visible link text

- **Where:** AppFooter.tsx:22-23 (“Public verification guide” for “Audit Protocol”, “Contact the Votex team” for “Support”)
- **Evidence:** Voice-control users cannot say the visible label (WCAG 2.5.3).
- **Change:** Remove the aria-labels.
- **Status:** Resolved in Phase A (foundations)

### UX-126 · Medium · Decorative icons not hidden from assistive tech

- **Where:** Roughly 60 lucide icons across WorldIDSignIn, ElectionDetail, Dashboard, NullificationDialog, HowItWorks, NotFound, authority components
- **Evidence:** Icons are announced as empty images.
- **Change:** aria-hidden on decorative icons; sr-only text on icon-only buttons.

### UX-127 · Medium · Delegation radiogroup has no accessible label; stale selection survives reopen

- **Where:** DelegationDialog.tsx:38,75
- **Evidence:** Label element lacks htmlFor; selectedIndex never resets.
- **Change:** aria-labelledby on RadioGroup; reset on open.
- **Status:** Resolved in Phase E (election detail, voting, delegation)

### UX-128 · Medium · Textarea and search inputs trigger iOS focus zoom

- **Where:** ui/textarea.tsx:14 (text-sm), NavBar.tsx:89, Index.tsx:64, Elections.tsx sort select
- **Evidence:** Font size under 16 px on mobile.
- **Change:** text-base md:text-sm.

### UX-129 · Medium · Manual numbers inside an ordered list

- **Where:** AuditProtocol.tsx:7-13
- **Evidence:** Screen readers read “1. 1. Election record”.
- **Change:** Drop the manual numbers.

### UX-130 · Low · Badge renders as a div with dead focus styles; AlertTitle is an h5

- **Where:** ui/badge.tsx:7,30-33; ui/alert.tsx:39
- **Evidence:** Semantics and heading order issues wherever used.
- **Change:** span for badges; non-heading element for alert titles.
- **Status:** Resolved in Phase A (foundations)

### UX-131 · Low · Unused TooltipProvider and identical gradient button variant

- **Where:** App.tsx:59; ui/button.tsx:23-24
- **Evidence:** Dead code that suggests affordances that do not exist.
- **Change:** Remove.
- **Status:** Resolved in Phase A (foundations)


## Mobile (7)

_Phone-width behaviour observed on the Pixel 7 profile._

### UX-132 · High · Fixed bottom navigation covers content and the footer

- **Where:** NavBar.tsx:122-136; pages without bottom padding (Success, sign-in, authority); screenshots 1, 11, 42 mobile
- **Evidence:** The “Find Elections” button and the step-2 panel sit under the bar on first paint; the authority console's own bottom bar overlaps stat tiles.
- **Change:** Add safe-area bottom padding to the layout shell equal to the bar height.

### UX-133 · High · Toast stack covers the page header on phones

- **Where:** Toaster position top on small screens (screenshots 20, 23, 42 mobile)
- **Evidence:** Up to three toasts hide the title and the first actions.
- **Change:** Bottom placement on mobile, max two visible, swipe to dismiss.

### UX-134 · Medium · Authority tabs wrap outside their pill group

- **Where:** ElectionAuthorityDashboard.tsx tabs (screenshot 42 mobile: “Process Tally” drops to a second line)
- **Evidence:** Looks broken.
- **Change:** Scrollable tab strip or stacked segmented control.
- **Status:** Resolved in Phase H (authority console)

### UX-135 · Medium · Stat tiles stack into a full screen of single numbers

- **Where:** ElectionAuthorityDashboard.tsx:231-258 on narrow widths
- **Evidence:** Four large tiles push the actual controls below the fold.
- **Change:** Two-column compact tiles or a single summary row.
- **Status:** Resolved in Phase H (authority console)

### UX-136 · Medium · No search on phones and tablets

- **Where:** NavBar.tsx:78 (hidden lg:flex); Elections.tsx:189 only echoes the query
- **Evidence:** The elections browser cannot be searched below 1024 px.
- **Change:** Render the search field inside the page below lg.

### UX-137 · Medium · Option cards and ballot buttons are tall; Cast vote sits far from the options

- **Where:** ElectionDetail.tsx mobile layout (screenshot 23 mobile)
- **Evidence:** Long scroll between choosing and confirming.
- **Change:** Sticky action bar with the selected option and the Cast button on phones.

### UX-138 · Low · Footer link row wraps leaving “Operator Entrance” orphaned

- **Where:** AppFooter.tsx (screenshot 1 mobile)
- **Evidence:** Ragged footer.
- **Change:** Stack links in two columns on narrow widths.


## Copy and terminology (12)

_Vocabulary drift, jargon, claims, grammar._

### UX-139 · High · Nine names for the voting key and four for the unlock action

- **Where:** “Votex passkey”, “Voting Passkey”, “passkey”; “signing key”, “voting key”, “ballot key”, “keypair”, “BabyJubJub key”, “cryptographic identity”; “Unlock with Passkey”, “Re-derive with Passkey”, “Unlock Passkey”, “Derive your keypair” (Dashboard.tsx, WorldIDSignIn.tsx, ElectionDetail.tsx, useDeriveKeypair.ts, FAQ.tsx, HowItWorks.tsx)
- **Evidence:** Users cannot tell whether these are one thing or several.
- **Change:** Glossary: “passkey” (credential), “voting key” (derived key), verb “unlock”. Never “derive” or “keypair” in UI.

### UX-140 · High · Vote vs ballot, actual/dummy vs real/decoy, nullify vs invalidate vs cancel

- **Where:** ElectionDetail.tsx:641,709,370; NullificationDialog.tsx:42,57,75,77; Privacy.tsx:10; FAQ.tsx:8,28; README.md:26
- **Evidence:** Core verbs change from screen to screen.
- **Change:** “ballot” is the record, “vote” the act; “nullify” and “decoy” only; define “nullify” once.

### UX-141 · High · Raw error.message and internal strings reach voters

- **Where:** ElectionDetail.tsx:98,379,466; WorldIDSignIn.tsx:137,185,197,285,292; useDeriveKeypair.ts:78; Elections.tsx:61,80; tallyService.ts:122 (“Accumulator for  contains an invalid point”)
- **Evidence:** “No nullifier found in IDKit result”, “Derived keypair failed validation”.
- **Change:** One error-code-to-sentence map; never pass error.message into voter toasts.
- **Status:** Resolved in Phase A (foundations)

### UX-142 · Medium · Authority has seven names

- **Where:** “Election Authority”, “Votex Election Authority”, “Operator Entrance”, “Election Authority Entrance”, “Authority Portal”, “Votex Authority”, “Election Authority Admin Panel”, “Authority command surface”
- **Evidence:** Brand and role blur.
- **Change:** “Election Authority” for the role, “operator” for the person, one console name.

### UX-143 · Medium · Four status vocabularies

- **Where:** Elections.tsx:30-33 (Active/Closed/Expired), ElectionDetail.tsx:536-541 (Active ballot/Live/Closed), AuthorityElectionsList.tsx:168-179 (Manually Closed/Tallied/Pending Tally), ElectionAuthorityDashboard.tsx:208,254 (Done/Ready/Live), TallyResultsDisplay.tsx:148
- **Evidence:** The same state has different words in each surface.
- **Change:** One status enum rendered by one StatusPill.
- **Status:** Resolved in Phase A (foundations)

### UX-144 · Medium · Jargon in voter-facing text

- **Where:** “BabyJubJub” (Dashboard.tsx:141, HowItWorks.tsx:54, ElectionDetail.tsx:577), “XOR accumulator”, “Groth16” (AuditProtocol.tsx), “public coordinate”, “Public Key X/Y”, “Serialized signature”, “Sanitized public records”, “Election telemetry”, “Ledger composer”
- **Evidence:** Reads as an engineer's console.
- **Change:** Plain names; technical detail on the audit page only.

### UX-145 · Medium · Title Case and sentence case mixed in buttons and headings

- **Where:** Title Case: “Publish Election”, “Delegate Vote”, “Begin Tally Processing”; sentence case: “Cast vote”, “Back to elections”, “Continue on localhost”; mixed headings “Submit a Nullification”
- **Evidence:** Inconsistent voice.
- **Change:** Sentence case throughout; proper nouns only.

### UX-146 · Medium · “Ledger” used for a database table

- **Where:** NotFound.tsx:15, VoteReceiptCard.tsx:84, Elections.tsx:68, AuthorityElectionsList.tsx:129
- **Evidence:** Implies an immutable chain that does not exist.
- **Change:** “public record”.

### UX-147 · Medium · Grammar and number agreement

- **Where:** ElectionAuthorityInterface.tsx:115-116 (“1 delegation … were ignored”), :71 (“Resolved 1 voter records”); TallyResultsDisplay.tsx:256 (“1 tracked ballots”); AuthorityElectionsList.tsx:131 (“under active management” for closed)
- **Evidence:** Visible on common counts.
- **Change:** Plural helper; rewrite the management line.
- **Status:** Resolved in Phase A (foundations)

### UX-148 · Low · Ellipsis character vs three dots

- **Where:** “…” in 6 files, “...” in 12
- **Evidence:** Typographic inconsistency.
- **Change:** Use “…”.

### UX-149 · Low · Placeholder and empty-state copy that explains nothing

- **Where:** ElectionForm.tsx:108 (“preserve signature clarity”), :38 (“consensus question”); AuthorityElectionsList.tsx:140 (“This authority has not published any elections”, but voters create them)
- **Evidence:** Filler.
- **Change:** Rewrite or remove.

### UX-150 · Low · README product steps are stale

- **Where:** README.md:46,52 (“click Create Election” twice; button is “Publish Election”); no mention of delegation or nullification UI
- **Evidence:** Onboarding text disagrees with the screen.
- **Change:** Update after the copy pass.


## Visual system (9)

_Tokens, spacing, radius, type scale and component consistency._

### UX-151 · Medium · Duplicate utility classes

- **Where:** index.css: .civic-card = .ledger-panel (:124-126 vs :77-79); .civic-label = .ledger-eyebrow (:136-138 vs :100-102)
- **Evidence:** Both pairs are used interchangeably, sometimes in one file.
- **Change:** Keep one of each.
- **Status:** Resolved in Phase A (foundations)

### UX-152 · Medium · Hand-built card recipe repeated instead of the shared class

- **Where:** rounded-xl border border-outline-variant/12 bg-surface-container-lowest p-6 shadow-sm in ElectionAuthorityDashboard.tsx:232-251, AuthorityElectionsList.tsx:115, ElectionForm.tsx:49-90, ElectionEditForm.tsx:146-205, WorldIDSignIn.tsx:416,515, HowItWorks.tsx:105
- **Evidence:** Drift waiting to happen.
- **Change:** A Card or StatCard component.

### UX-153 · Medium · Border-opacity zoo and radius mix

- **Where:** outline-variant at /8, /10, /12, /15, /16, /20, /40, /50; rounded-[1rem] on sign-in buttons flips radius between states (WorldIDSignIn.tsx:390-507); rounded-lg sm:rounded-xl on the nullify card
- **Evidence:** Edges look slightly different everywhere.
- **Change:** Two border tokens, three radii.
- **Status:** Resolved in Phase A (foundations)

### UX-154 · Medium · Off-palette colours

- **Where:** bg-blue-50/text-blue-800 (ElectionDetail.tsx:530,684), bg-green-100/text-green-800 (VoteReceiptCard.tsx:39), bg-white/80 (Index.tsx:149), nine white alphas, two literal shadow values, shadcn tokens in DelegationDialog.tsx:69,84
- **Evidence:** Bypasses theming and the token system.
- **Change:** Map to tokens.

### UX-155 · Medium · Type scale drift for labels and headings

- **Where:** text-[10px] ×8, text-[11px] ×14, text-xs; tracking-[0.05em] ×37, [0.08em], [-0.03em] ×14, [-0.035em]; font-extrabold h2s beside font-bold and font-semibold at the same level
- **Evidence:** No single scale.
- **Change:** Define label, eyebrow and display tokens in the Tailwind theme.

### UX-156 · Medium · Container widths and page headers differ per page

- **Where:** max-w-4xl, 5xl, 3xl, 6xl (skeleton only); pt-8 vs pt-10; min-h-[calc(100vh-64px)] vs 72px; three header patterns (eyebrow+h1, pill+h1, back-link+pills+h1)
- **Evidence:** Pages feel assembled from different kits.
- **Change:** One page-header component and one container.

### UX-157 · Low · Public-ballot notice styled as an error

- **Where:** Index.tsx (red warning triangle in a pink circle on a blue card, screenshot 1)
- **Evidence:** Reads as a problem rather than a property of the system.
- **Change:** Info icon and neutral tone.

### UX-158 · Low · Button inconsistencies

- **Where:** ledger-button-primary next to Button variant="outline" (ElectionDetail.tsx:702-718); icons with mr-2 on top of gap-2; bespoke rounded-xl “Manage Dashboard”
- **Evidence:** Different heights and spacing in one row.
- **Change:** Use the Button component everywhere.

### UX-159 · Low · Icon sizes vary without a rule

- **Where:** h-4, h-5, h-6, h-7, h-8, h-9, h-10 across feature cards
- **Evidence:** Visual rhythm breaks.
- **Change:** Three sizes: 16, 20, 32.


## Platform hygiene (6)

_Titles, scroll, error boundary, theming and motion preferences._

### UX-160 · High · Every route is titled “Votex”

- **Where:** All 54 steps reported title “Votex”; no title hook exists
- **Evidence:** Tabs, history and screen-reader page announcements are indistinguishable.
- **Change:** usePageTitle("Elections · Votex") per page; include the election title and receipt id where relevant.
- **Status:** Resolved in Phase A (foundations)

### UX-161 · High · No error boundary around routes

- **Where:** App.tsx:87
- **Evidence:** A failed lazy chunk after a deploy renders a blank page.
- **Change:** Error boundary with a Reload action around Suspense.
- **Status:** Resolved in Phase A (foundations)

### UX-162 · Medium · No prefers-reduced-motion handling

- **Where:** index.css:53-55 (scroll-smooth), animate-pulse skeletons, 14 spinners, Radix animations, hover translate/scale
- **Evidence:** Motion plays for users who asked for none.
- **Change:** Global reduced-motion rule; motion-safe variants.
- **Status:** Resolved in Phase A (foundations)

### UX-163 · Medium · Forced light theme without declaring color-scheme

- **Where:** tailwind.config.ts:4 declares darkMode class with no dark tokens; body background hard-coded; no color-scheme
- **Evidence:** Native selects, date pickers and scrollbars follow the OS and render dark on a light page.
- **Change:** Add color-scheme: light (or implement dark tokens); remove dead --sidebar/--card variables.
- **Status:** Resolved in Phase A (foundations)

### UX-164 · Medium · index.html has a blank line before the doctype and no explicit icon or theme-color

- **Where:** index.html:1; no link rel=icon, apple-touch-icon, theme-color; twitter:card without og:image
- **Evidence:** Quirks risk in some tooling; poor install and share previews.
- **Change:** Trim, add icons and an og image.
- **Status:** Resolved in Phase A (foundations)

### UX-165 · Low · Dates rely on toLocaleString() without options in eight files

- **Where:** VoteReceiptCard.tsx, AuthorityAuditLog.tsx, ElectionEditForm.tsx, ElectionAuthorityDashboard.tsx, ElectionAuthorityInterface.tsx, ElectionPublicAudit.tsx, TallyResultsDisplay.tsx, Elections.tsx
- **Evidence:** Locale-dependent format, no zone, no .
- **Change:** One formatDateTime with Intl and timeZoneName.
- **Status:** Resolved in Phase A (foundations)

