/**
 * Moves keyboard focus to an element after an action replaces the control
 * the user activated (a button that disappears, a dialog whose opener is
 * gone). Called after React commits, so the target exists.
 */
export function focusElement(target: HTMLElement | null | undefined) {
  if (!target) return;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  requestAnimationFrame(() => target.focus({ preventScroll: false }));
}

export function focusById(id: string) {
  focusElement(document.getElementById(id));
}
