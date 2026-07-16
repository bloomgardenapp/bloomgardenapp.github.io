// cloud.js — optional account + cloud sync. Sign in with an emailed link (no passwords),
// and the whole garden saves to the database on every change. Zero dependencies: raw
// fetch against Supabase's auth + REST endpoints.
import { store } from './store.js';
import { toast } from './ui.js';

// ── Supabase project. Leave blank and Bloom stays fully local — the account
// section simply hides itself. The publishable key is designed to be public.
export const CLOUD = {
  url: 'https://rbljgkthmbfvqtataocc.supabase.co',
  key: 'sb_publishable__JUTOmE75UnmBQav7J9CCw_UbGu4iY8',
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
  // publishable keys aren't JWTs — only send Authorization once we hold a user token
  ...(authed && session ? { Authorization: `Bearer ${session.access_token}` } : {}),
});

// ── auth: email → sign-in link → the link lands back on Bloom with a session in the hash
export async function requestLink(email) {
  // redirect_to brings the link back to THIS site (github.io / vercel / localhost) —
  // each origin must be allowlisted in Supabase Auth → URL Configuration → Redirect URLs
  const back = encodeURIComponent(location.origin + location.pathname);
  const res = await fetch(`${CLOUD.url}/auth/v1/otp?redirect_to=${back}`, {
    method: 'POST', headers: jsonHeaders(false),
    body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.msg || err.error_description || 'Could not send the link');
  }
}

// The email carries a 6-digit code too (once the template includes {{ .Token }}) —
// typing it signs in right here, no link-click needed.
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

const decodeJwt = (t) => {
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { return null; }
};

// Call once at boot, before routing: if the URL hash carries Supabase auth tokens
// (the user just clicked their sign-in link), turn them into a session and clean the URL.
export function handleAuthRedirect() {
  const h = location.hash || '';
  if (!/access_token=|error_description=/.test(h)) return false;
  const params = new URLSearchParams(h.replace(/^#\/?/, ''));
  const clean = () => history.replaceState(null, '', location.pathname + location.search);
  const errDesc = params.get('error_description');
  if (errDesc) {
    clean();
    toast(errDesc.replace(/\+/g, ' '), 'leaf');
    return false;
  }
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const claims = decodeJwt(access_token);
  clean();
  if (!access_token || !claims?.sub) return false;
  saveSession({ access_token, refresh_token, user: { id: claims.sub, email: claims.email } });
  toast(`Signed in as ${claims.email}`, 'flower');
  return true;
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

// how much real life a garden holds — an empty fresh browser must never outrank a real garden
const substance = (s) => (s?.skills?.length || 0) + (s?.sessions?.length || 0)
  + (s?.tasks?.length || 0) + (s?.notes?.length || 0) + (s?.events?.length || 0);

// after sign-in (or on boot): a garden with actual plants beats an empty one,
// no matter the timestamps; only between two real gardens does newest-edit win
async function firstSync() {
  setStatus('syncing');
  const row = await pullGarden().catch(() => null);
  const cloudHas = substance(row?.data);
  const localHas = substance(store.state);
  const cloudNewer = row?.data && (row.edited_at || '') > (store.state.editedAt || '');
  if (row?.data && cloudHas && (!localHas || cloudNewer)) {
    store.replace(row.data);
    toast('Your garden is back', 'flower');
    setStatus('synced');
  } else if (!localHas && cloudNewer) {
    setStatus('synced'); // both empty, cloud current — nothing worth writing either way
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
