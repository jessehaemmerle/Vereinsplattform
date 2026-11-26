/** Host lookup cache shared between the proxy and server actions (same process, separate bundles → globalThis). */
export type TenantLookup = { exists: boolean; redirectTo?: string; at: number };

const store = globalThis as unknown as { __vpTenantCache?: Map<string, TenantLookup> };

export function tenantCache() {
  store.__vpTenantCache ??= new Map();
  return store.__vpTenantCache;
}

/** Call after a club is created, renamed or deleted. */
export function clearTenantCache() {
  store.__vpTenantCache?.clear();
}
