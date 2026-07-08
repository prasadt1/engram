/**
 * Deferred-feature flags for this build of Engram.
 *
 * Iris's frontend was bulk-copied as the UI starting point (see
 * WHATS_NEW.md), but Engram's backend does not yet implement every surface
 * that UI advertises. Rather than deleting the (working, well-tested)
 * component files for a feature we plan to bring back, we gate them here:
 * one flag flip re-enables nav entry + polling once the backend route
 * ships. Flip to true only alongside the matching backend route landing.
 */
export const FEATURES = {
  /** Practice tab (assignment propose/accept/complete) — Practice Loop
   * routes live at /api/v1/assignments*. Field capture stays off. */
  practice: true,
  /** Field capture + "continue on phone" QR — deferred iOS flow; the QR
   * deep-links to Iris infra that Engram doesn't run. Lives inside the
   * Practice tab's sub-nav, so this is currently moot while practice is
   * off, but kept independent in case Practice ships before Field does. */
  field: false,
  /** Triage / HITL organize flow (/api/v1/pending-approvals*) — no
   * matching backend route exists on Engram yet. */
  triage: false,
  /** Mentor's AI-personalized starter questions
   * (/api/v1/mentor/suggested-questions) — no matching backend route
   * exists on Engram yet. The UI already falls back to canned
   * STARTERS_BY_MODE on any failure, so this flag only prevents the
   * guaranteed-404 network call itself; the fallback stays wired either way. */
  mentorSuggestedQuestions: false,
  /** Print Sales tab (working-pro listing drafts) — depends on the same
   * /api/v1/pending-approvals* HITL routes as Triage, which don't exist on
   * Engram yet. Gated the same way as Practice: hidden from nav, guarded
   * at the render site, and its pending-drafts poll skipped so it doesn't
   * fire a guaranteed 404 on every tab switch for working-pro users. */
  printSales: false,
} as const;
