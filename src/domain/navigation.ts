/** Compatibility only: retired links land on the existing dashboard. */
export function retiredPageRedirect(input: string): string | null {
  const url = new URL(input, 'https://workspace.invalid');
  const retiredPath = /^\/client-discovery\/?$/i.test(url.pathname);
  const retiredQuery = url.searchParams.get('tab') === 'client-discovery';
  const retiredHash = /^#\/?client-discovery\/?$/i.test(url.hash);
  if (!retiredPath && !retiredQuery && !retiredHash) return null;
  if (retiredPath) url.pathname = '/';
  url.searchParams.set('tab', 'overview');
  if (retiredHash) url.hash = '';
  return url.pathname + url.search + url.hash;
}

export function initialWorkspaceTab(input: string): 'overview' | 'sourcing' {
  const target = retiredPageRedirect(input) ?? input;
  const url = new URL(target, 'https://workspace.invalid');
  return url.searchParams.get('tab') === 'overview' ? 'overview' : 'sourcing';
}
