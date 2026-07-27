import { useEffect } from "react";

function linkSession(id: string) {
  document.querySelectorAll<HTMLAnchorElement>("a[data-session-link]").forEach((link) => {
    const url = new URL(link.href, window.location.origin);
    url.searchParams.set("session", id);
    link.href = `${url.pathname}${url.search}${url.hash}`;
  });
}

export default function SessionHydrator() {
  useEffect(() => {
    const url = new URL(window.location.href);
    // Analysis is intentionally local-only.  Old URL session IDs are discarded
    // rather than triggering a remote API request or exposing private chart data.
    if (url.searchParams.has("session")) {
      url.searchParams.delete("session");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);
  return null;
}
