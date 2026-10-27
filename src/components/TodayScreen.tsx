import { useState } from 'react';
import { Check } from 'lucide-react';
import { Avatar, ChipSelect, CleanRing, DirtMeter } from './Bits';
import { cleanliness, daysOverdue, dirtiness, dueLabel, EFFORT_POINTS, isDue } from '../chores';
import { dateStr, getMe, type Member, type Room, type Task } from '../db';
import { useMembers, useNow, useRooms, useTasks } from '../hooks';
import { completeTask, undoComplete, type UndoToken } from '../actions';

const UPCOMING_DAYS = 3;

export function TodayScreen({ onEditTask }: { onEditTask: (id: string) => void }) {
  const now = useNow();
  const tasks = useTasks();
  const rooms = useRooms() ?? [];
  const members = useMembers();
  const [who, setWho] = useState<string>(() => getMe() || 'all');
  const [undo, setUndo] = useState<{ token: UndoToken; name: string } | null>(null);

  const today = dateStr(new Date(now));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const live = tasks.filter((t) => !t.archived && roomById.has(t.roomId));
  // "Mine" includes unassigned tasks — anyone can grab those.
  const mine = who === 'all' ? live : live.filter((t) => !t.assigneeId || t.assigneeId === who);

  const byUrgency = (a: Task, b: Task) => dirtiness(b, now) - dirtiness(a, now);
  const overdue = mine.filter((t) => daysOverdue(t, today) > 0).sort(byUrgency);
  const dueToday = mine.filter((t) => daysOverdue(t, today) === 0).sort(byUrgency);
  const upcoming = mine
    .filter((t) => !isDue(t, today) && daysOverdue(t, today) >= -UPCOMING_DAYS)
    .sort(byUrgency);

  const pct = cleanliness(live, now);
  const dueCount = overdue.length + dueToday.length;

  async function done(t: Task) {
    const token = await completeTask(t, who !== 'all' ? who : undefined);
    setUndo({ token, name: t.name });
    window.setTimeout(() => setUndo((u) => (u?.token === token ? null : u)), 5000);
  }

  const row = (t: Task) => (
    <TaskRow key={t.id} task={t} room={roomById.get(t.roomId)} member={t.assigneeId ? memberById.get(t.assigneeId) : undefined}
      today={today} now={now} onDone={() => void done(t)} onOpen={() => onEditTask(t.id)} />
  );

  return (
    <>
      <div className="hero card">
        <CleanRing pct={pct} size={76} />
        <div>
          <div className="hero-title">Home is {pct}% clean</div>
          <div className="hero-sub">
            {dueCount === 0 ? 'Nothing due — enjoy your day ✨' : `${dueCount} task${dueCount === 1 ? '' : 's'} to do today`}
          </div>
        </div>
      </div>

      {members.length > 0 && (
        <ChipSelect
          options={[{ value: 'all', label: 'Everyone' }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
          value={who}
          onChange={setWho}
        />
      )}

      {overdue.length > 0 && <><div className="section-label alert">Overdue</div><div className="list">{overdue.map(row)}</div></>}
      <div className="section-label">Today</div>
      {dueToday.length > 0
        ? <div className="list">{dueToday.map(row)}</div>
        : <div className="empty small">{overdue.length ? 'Catch up on the overdue ones above.' : 'All caught up for today.'}</div>}
      {upcoming.length > 0 && <><div className="section-label">Coming up</div><div className="list">{upcoming.map(row)}</div></>}

      {undo && (
        <div className="toast" role="status">
          <span>Done: {undo.name}</span>
          <button type="button" onClick={() => { void undoComplete(undo.token); setUndo(null); }}>Undo</button>
        </div>
      )}
    </>
  );
}

export function TaskRow({
  task, room, member, today, now, onDone, onOpen,
}: {
  task: Task; room?: Room; member?: Member; today: string; now: number; onDone: () => void; onOpen: () => void;
}) {
  const d = dirtiness(task, now);
  const late = daysOverdue(task, today) > 0;
  return (
    <div className="task">
      <button type="button" className="check" aria-label={`Mark ${task.name} done`} onClick={onDone}><Check size={18} /></button>
      <button type="button" className="task-body" onClick={onOpen}>
        <div className="task-title">{task.name}</div>
        <div className="task-meta">
          {room?.name}{room ? ' · ' : ''}<span className={late ? 'late' : undefined}>{task.archived ? 'Paused' : dueLabel(task, today)}</span> · {EFFORT_POINTS[task.effort]} pts
        </div>
        <DirtMeter dirt={d} />
      </button>
      <Avatar member={member} />
    </div>
  );
}
