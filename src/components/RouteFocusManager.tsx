import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export const MAIN_CONTENT_ID = "main";

/**
 * On every route change: scroll to the top and move keyboard focus to the
 * main landmark, so screen-reader and keyboard users start each page at its
 * beginning instead of wherever the previous page left them. Same-page hash
 * navigation (anchors) is left to the browser.
 */
export function RouteFocusManager() {
  const { pathname, hash } = useLocation();
  const previousPath = useRef(pathname);

  useEffect(() => {
    const isFirstRender = previousPath.current === pathname;
    previousPath.current = pathname;
    if (isFirstRender || hash) {
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (main) {
      main.focus({ preventScroll: true });
    }
  }, [pathname, hash]);

  return null;
}

/** Visually hidden until focused; the first tab stop on every page. */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-on-primary focus:shadow-ledger"
    >
      Skip to content
    </a>
  );
}
