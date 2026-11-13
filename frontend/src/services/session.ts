import type { AppUser } from "../types";

const SESSION_KEY = "deco_user_session";

export function readSession(): AppUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as AppUser : null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function writeSession(user: AppUser) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
