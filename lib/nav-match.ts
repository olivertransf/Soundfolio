/** Whether `pathname` should count as active for a nav `href` (path segment only, ignores query). */
export function pathMatchesNav(pathname: string, href: string): boolean {
  const p = href.split("?")[0];
  if (p === "/history" || p === "/demo/history") {
    return pathname === p || pathname.startsWith(`${p}/`);
  }
  return pathname === p;
}
