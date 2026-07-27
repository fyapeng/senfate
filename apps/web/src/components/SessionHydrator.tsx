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
    if (window.location.hostname === "fyapeng.com" || window.location.hostname.endsWith(".github.io")) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get("session") || sessionStorage.getItem("senfate.session");
    if (!id) return;
    linkSession(id);
    if (!url.searchParams.has("session")) return;
    fetch(`/api/session?id=${encodeURIComponent(id)}`)
      .then(response => response.ok ? response.json() : null)
      .then(value => {
        if (!value?.compiled || !value?.analysis) return;
        sessionStorage.setItem("senfate.session", id);
        sessionStorage.setItem("senfate.compile", JSON.stringify(value.compiled));
        sessionStorage.setItem("senfate.chart", JSON.stringify(value.compiled.result));
        sessionStorage.setItem("senfate.analysis", JSON.stringify(value.analysis));
        url.searchParams.delete("session");
        window.location.replace(`${url.pathname}${url.search}${url.hash}`);
      });
  }, []);
  return null;
}
