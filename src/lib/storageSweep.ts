// Shared localStorage helper: collect keys with a prefix, then remove them.
// The collect-then-remove pattern avoids mutating localStorage while iterating
// its indices (which shifts subsequent keys and skips entries). Guarded because
// storage can be disabled or full — sweep failures must never break sign-out.

export function sweepLocalStorageKeysWithPrefix(prefix: string): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage unavailable — nothing to sweep
  }
}
