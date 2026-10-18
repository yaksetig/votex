import { useEffect } from "react";

const SITE_NAME = "Votex";

/**
 * Sets the document title for the current page so browser tabs, history
 * and screen-reader page announcements can tell pages apart. Pass the
 * page-specific part only; the site name is appended. Pass `null` while
 * the page's subject is still loading to keep the previous title.
 */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title === null || title === undefined) {
      return;
    }
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  }, [title]);
}
