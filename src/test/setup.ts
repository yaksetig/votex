/**
 * Shared vitest setup. Loaded for every test file; the DOM-only pieces are
 * guarded so the default `node` environment (used by the crypto suites) is
 * unaffected. Component tests opt into jsdom with a vitest-environment
 * docblock at the top of the file.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });

  // Radix primitives (Dialog, Tabs, RadioGroup) probe layout APIs jsdom lacks.
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, "ResizeObserver", { value: ResizeObserverStub, writable: true });
  }
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
  if (typeof window.scrollTo !== "function" || window.scrollTo.toString().includes("not implemented")) {
    Object.defineProperty(window, "scrollTo", { writable: true, value: () => {} });
  }
}
