// Web Push: VAPID keys, subscription storage, and a send helper. Plain ESM.
//
// VAPID keys come from env (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY) if set, otherwise
// are generated once and persisted in the meta table — so a fresh server needs
// no extra setup and phone subscriptions survive restarts.
import webpush from 'web-push';
import { db } from './db.js';
import { authorized } from './sync.js';

function loadVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const row = db.prepare("SELECT v FROM meta WHERE k = 'vapid'").get();
  if (row) return JSON.parse(row.v);
  const keys = webpush.generateVAPIDKeys();
  db.prepare("INSERT INTO meta (k, v) VALUES ('vapid', ?)").run(JSON.stringify(keys));
  return keys;
}

const vapid = loadVapid();
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', vapid.publicKey, vapid.privateKey);

const upsertSubStmt = db.prepare(`
  INSERT INTO push_subs (endpoint, sub, scope, digestTime, tz, updatedAt)
  VALUES (@endpoint, @sub, @scope, @digestTime, @tz, @updatedAt)
  ON CONFLICT(endpoint) DO UPDATE SET
    sub = excluded.sub, scope = excluded.scope, digestTime = excluded.digestTime,
    tz = excluded.tz, updatedAt = excluded.updatedAt
`);
const deleteSubStmt = db.prepare('DELETE FROM push_subs WHERE endpoint = ?');
const deleteSentStmt = db.prepare('DELETE FROM push_sent WHERE endpoint = ?');
const getSubStmt = db.prepare('SELECT * FROM push_subs WHERE endpoint = ?');

export function removeSubscription(endpoint) {
  deleteSubStmt.run(endpoint);
  deleteSentStmt.run(endpoint);
}

/** Send one notification. Drops the subscription if the push service says it's gone. */
export async function sendPush(subRow, payload, log) {
  try {
    await webpush.sendNotification(JSON.parse(subRow.sub), JSON.stringify(payload), { TTL: 6 * 3600 });
    return true;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      removeSubscription(subRow.endpoint);
      log?.info({ endpoint: subRow.endpoint }, 'push subscription expired; removed');
    } else {
      log?.warn({ err: err.message, status: err.statusCode }, 'push send failed');
    }
    return false;
  }
}

function isValidTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export default async function pushRoutes(fastify) {
  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/push/') && !authorized(request)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });

  fastify.post('/api/push/key', async () => ({ publicKey: vapid.publicKey }));

  fastify.post('/api/push/subscribe', async (request, reply) => {
    const { subscription, scope, digestTime, tz } = request.body || {};
    if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.keys) {
      return reply.code(400).send({ error: 'subscription required' });
    }
    upsertSubStmt.run({
      endpoint: subscription.endpoint,
      sub: JSON.stringify(subscription),
      scope: typeof scope === 'string' && scope ? scope : 'all',
      digestTime: /^\d{2}:\d{2}$/.test(digestTime || '') ? digestTime : '',
      tz: isValidTz(tz) ? tz : 'UTC',
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  });

  fastify.post('/api/push/unsubscribe', async (request) => {
    const { endpoint } = request.body || {};
    if (typeof endpoint === 'string') removeSubscription(endpoint);
    return { ok: true };
  });

  fastify.post('/api/push/test', async (request, reply) => {
    const row = getSubStmt.get((request.body || {}).endpoint || '');
    if (!row) return reply.code(404).send({ error: 'subscription not found — turn reminders off and on again' });
    const ok = await sendPush(row, { title: 'Home', body: 'Reminders are working 🧹', tag: 'test' }, request.log);
    return ok ? { ok: true } : reply.code(502).send({ error: 'push service rejected the message' });
  });
}
