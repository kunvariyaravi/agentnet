'use client';

// Client-side session check.
//
// Only HTTP 401 means "logged out". Anything else that fails
// (429 rate limit, 5xx, network blip) is transient — callers must
// NOT redirect to /login on those, otherwise users get kicked out
// just by changing pages while polling is active.

export interface MeResult {
  user: any | null;
  /** true when the request failed for a non-auth reason — stay put, don't redirect */
  transient: boolean;
}

export async function fetchMe(): Promise<MeResult> {
  let res: Response;
  try {
    res = await fetch('/api/auth/me', { credentials: 'same-origin' });
  } catch {
    return { user: null, transient: true };
  }
  if (res.status === 401) return { user: null, transient: false };
  if (!res.ok) return { user: null, transient: true };
  try {
    const d = await res.json();
    if (!d.user) return { user: null, transient: false };
    return { user: d.user, transient: false };
  } catch {
    return { user: null, transient: true };
  }
}
