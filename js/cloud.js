// cloud.js — optional account + cloud sync. Sign in with an email code (no passwords),
// and the whole garden saves to the database on every change. Zero dependencies: raw
// fetch against Supabase's auth + REST endpoints.
import { store } from './store.js';
import { toast } from './ui.js';

// ── Fill these in from your Supabase project (Settings → API) and the app grows accounts.
// Leave blank and Bloom stays fully local — the account section simply hides itself.
export const CLOUD = {
  url: '',   // e.g. 'https://abcdefgh.supabase.co'
  key: '',   // the "anon public" key
};

const SKEY = 'bloom.session.v1';
export const cloudConfigured = () => !!(CLOUD.url && CLOUD.key);

let session = null;
try { session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch { session = null; }
const saveSession = (s) => {
  session = s;
  if (s) localStorage.setItem(SKEY, JSON.stringify(s));
  else localStorage.removeItem(SKEY);
};

export const signedIn = () => !!session?.access_token;
export const userEmail = () => session?.user?.email || null;

// ── sync status (Settings listens to show "synced just now" etc.)
let status = 'idle'; // idle | syncing | synced | error
const statusListeners = new Set();
export const syncStatus = () => status;
export const onSyncStatus = (fn) => { statusListeners.add(fn); return () => statusListeners.delete(fn); };
const setStatus = (s) => { status = s; for (const fn of [...statusListeners]) fn(s); };

const jsonHeaders = (authed) => ({
  'Content-Type': 'application/json',
  apikey: CLOUD.key,
  Authorization: `Bearer ${authed && session ? session.access_token : CLOUD.key}`,
});

// ── auth: email → 6-digit code → session
export async function requestCode(email) {
  const res = await fetch(`${CLOUD.url}/auth/v1/otp`, {
    method: 'POST', headers: jsonHeaders(false),
    body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.msg || err.error_description || 'Could not send the code');
  }
}

export async function verifyCode(email, token) {
  const res = await fetch(`${CLOUD.url}/auth/v1/verify`, {
    method: 'POST', headers: jsonHeaders(false),
    body: JSON.stringify({ email, token, type: 'email' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(data.msg || data.error_description || 'Wrong or expired code');
  saveSession(data);
  await firstSync();
}

async function refreshSession() {
  if (!session?.refresh_token) return false;
  const res = await fetch(`${CLOUD.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: jsonHeaders(false),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) { saveSession(null); return false; }
  saveSession(data);
  return true;
}

async function authedFetch(path, opts = {}, retry = true) {
  const res = await fetch(`${CLOUD.url}${path}`, {
    ...opts, headers: { ...jsonHeaders(true), ...(opts.headers || {}) },
  });
  if (res.status === 401 && retry && await refreshSession()) return authedFetch(path, opts, false);
  return res;
}

export function signOut() {
  authedFetch('/auth/v1/logout', { method: 'POST' }).catch(() => {});
  saveSession(null);
  setStatus('idle');
  toast('Signed out — this browser keeps its local copy', 'leaf');
}

// ── garden sync: one row per user, whole garden as JSON, newest edit wins
export async function pushGarden() {
  if (!signedIn()) return;
  setStatus('syncing');
  try {
    const res = await authedFetch('/rest/v1/gardens', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: session.user.id,
        data: store.state,
        edited_at: store.state.editedAt || new Date().toISOString(),
      }),
    });
    setStatus(res.ok ? 'synced' : 'error');
  } catch { setStatus('error'); }
}

async function pullGarden() {
  const res = await authedFetch(`/rest/v1/gardens?select=data,edited_at&user_id=eq.${session.user.id}`);
  if (!res.ok) throw new Error('pull failed');
  const rows = await res.json();
  return rows[0] || null;
}

// after sign-in (or on boot): whichever side was edited last becomes the truth
async function firstSync() {
  setStatus('syncing');
  const row = await pullGarden().catch(() => null);
  const localEdited = store.state.editedAt || '';
  if (row?.data && (row.edited_at || '') > localEdited) {
    store.replace(row.data);
    toast('Your garden is back', 'flower');
    setStatus('synced');
  } else {
    await pushGarden();
  }
}

let pushT = null;
const queuePush = () => {
  if (!signedIn()) return;
  clearTimeout(pushT);
  pushT = setTimeout(() => pushGarden(), 1500);
};

export function initCloud() {
  if (!cloudConfigured()) return;
  store.setOnSave(queuePush); // every save (silent or not) syncs shortly after
  if (signedIn()) firstSync().catch(() => setStatus('error'));
}
