/** Navigation seam: full page loads in the Next.js app; swappable for single-page builds. */
export function currentPath(): string {
  return window.location.pathname;
}

export function navigate(href: string): void {
  window.location.assign(href);
}
