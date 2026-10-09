import { TOKEN_STORAGE_KEY } from './config';

/**
 * The access token is kept in `localStorage` so a refresh does not log the user out.
 *
 * Trade-off, recorded in DESIGN.md: `localStorage` is readable by any script on the
 * origin, so this is weaker against XSS than an httpOnly cookie. It is accepted here
 * because there are no refresh tokens in scope and the alternative (cookie + CSRF
 * handling) buys nothing for a single-origin internal tool on a 3-hour budget.
 *
 * Every access is wrapped: a browser with site data blocked throws on `localStorage`
 * rather than returning null, and a crash on boot would be worse than a lost session.
 */

export function readToken(): string | null {
  try {
    const value = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return value !== null && value.length > 0 ? value : null;
  } catch {
    // Storage unavailable (private mode, blocked site data). Treat as "not logged in" —
    // the user can still log in, their session just will not survive a refresh.
    return null;
  }
}

export function writeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Non-fatal: the in-memory session continues to work for this tab.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to do — if we could not write it, there is nothing to remove.
  }
}
