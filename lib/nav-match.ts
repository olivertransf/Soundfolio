/** Whether `pathname` should count as active for a nav `href` (path segment only, ignores query). */
export function pathMatchesNav(pathname: string, href: string): boolean {
  const p = href.split("?")[0];
  if (p === "/library" || p === "/demo/library") {
    return pathname === p || pathname.startsWith(`${p}/`);
  }
  if (p === "/history" || p === "/demo/history") {
    return pathname === p || pathname.startsWith(`${p}/`);
  }
  if (p === "/me" || p === "/demo") {
    return pathname === p;
  }
  if (p === "/top-tracks" || p === "/top-artists" || p === "/top-albums") {
    return pathname.startsWith("/library") || pathname === p;
  }
  if (p === "/history/recent" || p === "/patterns") {
    return pathname.startsWith("/library");
  }
  return pathname === p || pathname.startsWith(`${p}/`);
}
