// Reminder scheduler: once a minute, for every push subscription, work out (in that
// device's own timezone) whether it's time for its daily digest or for a task's
// reminder, and send it once. Reads the synced records straight from SQLite, so
// reminders reflect whatever the phones last synced.
//
// Due-ness mirrors src/chores.ts isDue(): a task is due on the local calendar date
// of lastDoneAt + freqDays, and stays due until completed.
import { db } from './db.js';
import { sendPush } from './push.js';

const TICK_MS = 60_000;
const DAY_MS = 86_400_000;
// If the server was down at the exact minute, still send up to this long after.
const GRACE_MIN = 120;

const liveRowsStmt = db.prepare('SELECT payload FROM records WHERE tbl = ? AND deleted = 0');
const allSubsStmt = db.prepare('SELECT * FROM push_subs');
const wasSentStmt = db.prepare('SELECT 1 FROM push_sent WHERE endpoint = ? AND key = ?');
const markSentStmt = db.prepare('INSERT OR IGNORE INTO push_sent (endpoint, key) VALUES (?, ?)');

function live(tbl) {
  return liveRowsStmt.all(tbl).map((r) => JSON.parse(r.payload));
}

/** { date: 'YYYY-MM-DD', minutes: minutes since local midnight } in the given zone. */
function localParts(ms, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function hhmmToMin(s) {
  const m = /^(\d{2}):(\d{2})$/.exec(s || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** True if `target` minutes-of-day has arrived and is within the grace window. */
function inWindow(nowMin, target) {
  return target !== null && nowMin >= target && nowMin - target <= GRACE_MIN;
}

function summarize(names) {
  const head = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${head} +${names.length - 3} more` : head;
}

async function tick(log) {
  const subs = allSubsStmt.all();
  if (subs.length === 0) return;

  const roomIds = new Set(live('rooms').map((r) => r.id));
  const tasks = live('tasks').filter((t) => !t.archived && roomIds.has(t.roomId) && t.lastDoneAt);
  const now = Date.now();

  for (const sub of subs) {
    const { date: today, minutes } = localParts(now, sub.tz);
    const mine = tasks.filter((t) => sub.scope === 'all' || !t.assigneeId || t.assigneeId === sub.scope);
    const due = mine.filter((t) => localParts(Date.parse(t.lastDoneAt) + t.freqDays * DAY_MS, sub.tz).date <= today);

    // Daily digest
    const digestKey = `digest:${today}`;
    if (inWindow(minutes, hhmmToMin(sub.digestTime)) && !wasSentStmt.get(sub.endpoint, digestKey)) {
      markSentStmt.run(sub.endpoint, digestKey);
      if (due.length > 0) {
        await sendPush(sub, {
          title: `${due.length} chore${due.length === 1 ? '' : 's'} today`,
          body: summarize(due.map((t) => t.name)),
          tag: 'digest',
        }, log);
      }
    }

    // Per-task reminder times
    for (const t of due) {
      const key = `task:${t.id}:${today}`;
      if (!inWindow(minutes, hhmmToMin(t.remindAt)) || wasSentStmt.get(sub.endpoint, key)) continue;
      markSentStmt.run(sub.endpoint, key);
      await sendPush(sub, { title: 'Chore reminder', body: t.name, tag: `task-${t.id}` }, log);
    }
  }

  // Forget sent-markers older than a few days (keys embed the date).
  const cutoff = new Date(now - 4 * DAY_MS).toISOString().slice(0, 10);
  db.prepare("DELETE FROM push_sent WHERE substr(key, -10) < ?").run(cutoff);
}

export function startReminders(log) {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try { await tick(log); } catch (err) { log.error({ err }, 'reminder tick failed'); } finally { busy = false; }
  };
  setInterval(run, TICK_MS);
  void run();
}
