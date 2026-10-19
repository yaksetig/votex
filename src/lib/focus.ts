/**
 * Moves keyboard focus to the result of an action when the control the user
 * activated disappears (a button that is replaced, a dialog whose opener is
 * gone). Dialogs close with an exit animation and then restore focus
 * themselves, so a request is also remembered briefly for the dialog layer
 * to honour on close (see DialogContent in components/ui/dialog.tsx).
 */

const PENDING_WINDOW_MS = 2000;
let pending: { id: string; at: number } | null = null;

function prepare(target: HTMLElement) {
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
}

export function focusElement(target: HTMLElement | null | undefined) {
  if (!target) return;
  prepare(target);
  requestAnimationFrame(() => target.focus());
}

export function focusById(id: string) {
  pending = { id, at: Date.now() };
  focusElement(document.getElementById(id));
}

/** The element a closing dialog should focus instead of its (possibly removed) opener. */
export function consumePendingFocus(): HTMLElement | null {
  if (!pending) return null;
  const { id, at } = pending;
  pending = null;
  if (Date.now() - at > PENDING_WINDOW_MS) return null;
  const target = document.getElementById(id);
  if (target) prepare(target);
  return target;
}
