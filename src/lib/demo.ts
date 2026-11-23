// "Try without an account": a demo session inside the live app, for showing the app to others.
// It uses its own local database ("fangbuch-demo"), never talks to the server and is filled with
// example days. Leaving deletes the demo database, so real entries on the same phone are untouched.
import Dexie from 'dexie';

const KEY = 'captura-demo';

function read(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

/** True while someone is looking around without an account. Fixed for the lifetime of the page. */
export const trySession = read();

export const DB_NAME = trySession ? 'fangbuch-demo' : 'fangbuch';

export function enterDemo() {
  try { localStorage.setItem(KEY, '1'); } catch { /* private mode: the reload just shows the start screen again */ }
  location.hash = '#/';
  location.reload();
}

export async function exitDemo() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  await Dexie.delete('fangbuch-demo').catch(() => {});
  location.hash = '#/';
  location.reload();
}
