/** Scroll to #id with retries (CMS sections may mount late) and force reveal visible. */
export function scrollToHashId(
  hash: string,
  opts?: { maxAttempts?: number; intervalMs?: number },
): void {
  if (typeof window === "undefined") return;
  const id = hash.replace(/^#/, "").trim();
  if (!id) return;

  const maxAttempts = opts?.maxAttempts ?? 50;
  const intervalMs = opts?.intervalMs ?? 50;

  const attempt = (n: number) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("is-inview");
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      try {
        const path = `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(null, "", `${path}#${id}`);
      } catch {
        /* ignore */
      }
      return;
    }
    if (n < maxAttempts) {
      window.setTimeout(() => attempt(n + 1), intervalMs);
    }
  };

  attempt(0);
}

type NavigateFn = (to: string, opts?: { replace?: boolean }) => void;

/**
 * In-app navigation for same-origin hrefs that may include #hash.
 * Avoids full document reload from plain <a href="/#…">.
 */
export function navigateAppHref(href: string, setLocation: NavigateFn): void {
  if (typeof window === "undefined") return;
  if (/^https?:\/\//i.test(href)) {
    window.location.assign(href);
    return;
  }

  const hashIdx = href.indexOf("#");
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : "";
  const withoutHash = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const qIdx = withoutHash.indexOf("?");
  const path = (qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash) || "/";
  const search = qIdx >= 0 ? withoutHash.slice(qIdx) : "";

  const currentPath = window.location.pathname || "/";
  const samePath =
    currentPath === path ||
    (path === "/" && (currentPath === "/" || currentPath === ""));

  if (samePath && hash.length > 1) {
    scrollToHashId(hash);
    return;
  }

  setLocation(`${path}${search}${hash}`);
}
