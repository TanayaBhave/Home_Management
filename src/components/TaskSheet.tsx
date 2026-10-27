// Add / edit one chore: name, room, how often, effort, who, reminder time, and
// a Sweepy-style "how dirty is it right now" slider.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from './Sheet';
import { ChipSelect, Field } from './Bits';
import { baseFields, db, nowISO, softDelete, type Effort, type Task } from '../db';
import { EFFORT_LABEL, EFFORT_POINTS, FREQ_PRESETS, dirtiness, dueLabel, lastDoneForDirtiness } from '../chores';
import { TEMPLATES } from '../templates';
import { useMembers, useRooms } from '../hooks';
import { completeTask } from '../actions';

export function TaskSheet({ editId, roomId, onClose }: { editId?: string; roomId?: string; onClose: () => void }) {
  const existing = useLiveQuery(() => (editId ? db.tasks.get(editId) : undefined), [editId]);
  if (editId && !existing) return null; // still loading
  return <TaskForm key={existing?.id ?? 'new'} existing={existing} roomId={roomId} onClose={onClose} />;
}

function TaskForm({ existing, roomId, onClose }: { existing?: Task; roomId?: string; onClose: () => void }) {
  const rooms = useRooms() ?? [];
  const members = useMembers();
  const [name, setName] = useState(existing?.name ?? '');
  const [room, setRoom] = useState(existing?.roomId ?? roomId ?? '');
  const [freq, setFreq] = useState(existing?.freqDays ?? 7);
  const [effort, setEffort] = useState<Effort>(existing?.effort ?? 1);
  const [assignee, setAssignee] = useState(existing?.assigneeId ?? '');
  const [remindAt, setRemindAt] = useState(existing?.remindAt ?? '');
  const [paused, setPaused] = useState(!!existing?.archived);
  // Slider in percent: 0 = spotless, 100 = due, up to 150 = overdue.
  const [dirtPct, setDirtPct] = useState(() => Math.round(Math.min(1.5, existing ? dirtiness(existing) : 0) * 100));
  const [err, setErr] = useState('');

  const roomKind = rooms.find((r) => r.id === room)?.kind;
  const suggestions = !existing && roomKind ? TEMPLATES[roomKind] : [];
  const isPreset = FREQ_PRESETS.some((p) => p.days === freq);

  async function save() {
    if (!name.trim()) return setErr('Give the task a name.');
    if (!room) return setErr('Pick a room.');
    if (!(freq >= 1)) return setErr('Frequency must be at least 1 day.');
    const fields = {
      name: name.trim(), roomId: room, freqDays: Math.round(freq), effort,
      assigneeId: assignee || undefined, remindAt: remindAt || undefined, archived: paused ? 1 : 0,
    };
    if (existing) {
      const draft = { ...existing, ...fields };
      const origPct = Math.round(Math.min(1.5, dirtiness(existing)) * 100);
      // Only rewrite lastDoneAt if the slider was moved (or freq changed) — otherwise keep history exact.
      const lastDoneAt = dirtPct !== origPct || existing.freqDays !== draft.freqDays
        ? lastDoneForDirtiness(draft, dirtPct / 100)
        : existing.lastDoneAt;
      await db.tasks.update(existing.id, { ...fields, lastDoneAt, updatedAt: nowISO() });
    } else {
      const t: Task = { ...baseFields(), ...fields, lastDoneAt: '' };
      t.lastDoneAt = lastDoneForDirtiness(t, dirtPct / 100);
      await db.tasks.add(t);
    }
    onClose();
  }

  async function remove() {
    if (!existing || !confirm(`Delete "${existing.name}"?`)) return;
    await softDelete(db.tasks, existing.id);
    onClose();
  }

  async function doneNow() {
    if (!existing) return;
    await completeTask(existing);
    onClose();
  }

  return (
    <Sheet title={existing ? 'Edit task' : 'New task'} onClose={onClose} onSave={() => void save()} warn={err || undefined} onDelete={existing ? () => void remove() : undefined}>
      <Field label="Task">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clean toilet" />
      </Field>
      {suggestions.length > 0 && (
        <div className="choices suggest">
          {suggestions.map((s) => (
            <button key={s.name} type="button" className="chip small" onClick={() => { setName(s.name); setFreq(s.freqDays); setEffort(s.effort); }}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <Field label="Room">
        <select value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="">Choose…</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>

      <Field label="How often">
        <ChipSelect options={FREQ_PRESETS.map((p) => ({ value: p.days, label: p.label }))} value={isPreset ? freq : undefined} onChange={setFreq} />
        <div className="inline-num">
          Every <input type="number" min={1} inputMode="numeric" value={freq} onChange={(e) => setFreq(Number(e.target.value))} aria-label="Days between" /> days
        </div>
      </Field>

      <Field label="Effort">
        <ChipSelect
          options={([1, 2, 3] as Effort[]).map((e) => ({ value: e, label: `${EFFORT_LABEL[e]} · ${EFFORT_POINTS[e]} pts` }))}
          value={effort}
          onChange={setEffort}
        />
      </Field>

      <Field label="Who does it">
        <ChipSelect
          options={[{ value: '', label: 'Anyone' }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
          value={assignee}
          onChange={setAssignee}
        />
      </Field>

      <Field label={`How dirty is it right now? ${dirtPct}%`} hint={dirtPct >= 100 ? 'Due now' : dirtPct === 0 ? 'Just cleaned' : `About ${Math.max(1, Math.round((1 - dirtPct / 100) * freq))} day(s) until due`}>
        <input type="range" min={0} max={150} step={5} value={dirtPct} onChange={(e) => setDirtPct(Number(e.target.value))} className={`slider${dirtPct >= 100 ? ' hot' : ''}`} aria-label="Dirtiness" />
      </Field>

      <Field label="Reminder time (optional)" hint="On days this task is due, devices with reminders on get a push at this time.">
        <div className="row-input">
          <input type="time" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
          {remindAt && <button type="button" className="btn ghost small" onClick={() => setRemindAt('')}>Clear</button>}
        </div>
      </Field>

      {existing && (
        <>
          <label className="toggle">
            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} /> Pause this task (never comes due)
          </label>
          <div className="hint">{existing.archived ? 'Paused' : dueLabel(existing)} · last done {new Date(existing.lastDoneAt).toLocaleDateString()}</div>
          <div className="sheet-actions">
            <button type="button" className="btn save" onClick={() => void doneNow()}>Mark done now</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
