// Web Push reminders. The server (server/reminders.js) owns the schedule and sends
// pushes; this module only manages this device's subscription + its preferences.
//
// iOS: push only works from the Home Screen-installed app (iOS 16.4+), and
// permission must be requested from a tap.
//
// Device-local state (localStorage): pushDigestTime ('HH:MM' | ''), pushScope ('all' | memberId).

export interface PushPrefs {
  digestTime: string; // '' = no daily digest
  scope: string;      // 'all' or a Member.id — whose chores this device hears about
}

export function getPushPrefs(): PushPrefs {
  return {
    digestTime: localStorage.getItem('pushDigestTime') ?? '08:00',
    scope: localStorage.getItem('pushScope') ?? 'all',
  };
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** iOS only exposes push to installed (standalone) PWAs. */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function api(path: string): string {
  const base = (localStorage.getItem('syncUrl') ?? '').trim().replace(/\/+$/, '');
  return `${base}/api/push/${path}`;
}

async function call(path: string, body: unknown) {
  const token = localStorage.getItem('syncToken');
  if (!token) throw new Error('Set the server token under Sync first.');
  const resp = await fetch(api(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Server said HTTP ${resp.status}`);
  return resp.json();
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Ask permission (must run from a tap), subscribe, and register with the server. */
export async function enablePush(prefs: PushPrefs): Promise<void> {
  if (!pushSupported()) throw new Error('This browser does not support push notifications.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications were not allowed.');
  const { publicKey } = (await call('key', {})) as { publicKey: string };
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await savePushPrefs(prefs, sub);
}

/** Persist prefs locally and, if subscribed, on the server. */
export async function savePushPrefs(prefs: PushPrefs, sub?: PushSubscription | null): Promise<void> {
  localStorage.setItem('pushDigestTime', prefs.digestTime);
  localStorage.setItem('pushScope', prefs.scope);
  const s = sub ?? (await currentSubscription());
  if (!s) return;
  await call('subscribe', {
    subscription: s.toJSON(),
    digestTime: prefs.digestTime,
    scope: prefs.scope,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  try { await call('unsubscribe', { endpoint: sub.endpoint }); } catch { /* server may be unreachable */ }
  await sub.unsubscribe();
}

export async function testPush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) throw new Error('Reminders are not enabled on this device.');
  await call('test', { endpoint: sub.endpoint });
}
