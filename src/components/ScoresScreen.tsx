// Leaderboard (points per member for a period) + recent activity feed.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Avatar, ChipSelect } from './Bits';
import { db } from '../db';
import { useCompletions, useMembers } from '../hooks';

type Period = 'week' | 'month' | 'all';

function periodStart(p: Period): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  else if (p === 'month') d.setDate(1);
  else return '';
  return d.toISOString();
}

export function ScoresScreen() {
  const [period, setPeriod] = useState<Period>('week');
  const since = useMemo(() => periodStart(period), [period]);
  const completions = useCompletions(since);
  const members = useMembers();
  const taskNames = useLiveQuery(async () => new Map((await db.tasks.toArray()).map((t) => [t.id, t.name])), []) ?? new Map<string, string>();

  const rows = members.map((m) => {
    const mine = completions.filter((c) => c.memberId === m.id);
    return { member: m, points: mine.reduce((s, c) => s + c.points, 0), count: mine.length };
  });
  const unclaimed = completions.filter((c) => !c.memberId || !members.some((m) => m.id === c.memberId));
  rows.sort((a, b) => b.points - a.points);
  const max = Math.max(1, ...rows.map((r) => r.points));
  const memberById = new Map(members.map((m) => [m.id, m]));

  return (
    <>
      <ChipSelect
        options={[{ value: 'week', label: 'This week' }, { value: 'month', label: 'This month' }, { value: 'all', label: 'All time' }]}
        value={period}
        onChange={setPeriod}
      />
      <div className="card board">
        {rows.length === 0 && <div className="empty small">Add household members in Settings to start a leaderboard.</div>}
        {rows.map((r, i) => (
          <div key={r.member.id} className="board-row">
            <div className="rank">{i === 0 && r.points > 0 ? '🏆' : i + 1}</div>
            <Avatar member={r.member} size={32} />
            <div className="board-main">
              <div className="board-name">{r.member.name} <span className="muted">· {r.count} task{r.count === 1 ? '' : 's'}</span></div>
              <div className="bar"><div style={{ width: `${(r.points / max) * 100}%`, background: r.member.color }} /></div>
            </div>
            <div className="pts">{r.points}</div>
          </div>
        ))}
        {unclaimed.length > 0 && (
          <div className="hint" style={{ margin: '10px 4px 0' }}>
            + {unclaimed.length} task{unclaimed.length === 1 ? '' : 's'} done without a name — set “This device is” in Settings so points get credited.
          </div>
        )}
      </div>

      <div className="section-label">Recent</div>
      <div className="list">
        {completions.slice(0, 30).map((c) => {
          const m = c.memberId ? memberById.get(c.memberId) : undefined;
          return (
            <div key={c.id} className="feed-row">
              <Avatar member={m} size={22} />
              <div className="feed-main">
                <div><b>{m?.name ?? 'Someone'}</b> did {taskNames.get(c.taskId) ?? 'a task'}</div>
                <div className="muted">{new Date(c.doneAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>
              </div>
              <div className="pts small">+{c.points}</div>
            </div>
          );
        })}
        {completions.length === 0 && <div className="empty small">Nothing done yet in this period.</div>}
      </div>
    </>
  );
}
