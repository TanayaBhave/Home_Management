// Rooms grid (cleanliness per room) → room sheet with its tasks, add/rename/delete room.
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from './Sheet';
import { CleanRing, ChipSelect, Field } from './Bits';
import { TaskRow } from './TodayScreen';
import { cleanliness, dirtiness, isDue } from '../chores';
import { dateStr, db, nowISO, type Room, type RoomKind } from '../db';
import { useMembers, useNow, useRooms, useTasks } from '../hooks';
import { completeTask, deleteRoom } from '../actions';
import { createRoom, ROOM_KINDS, roomKindInfo } from '../templates';

export function RoomsScreen({ onEditTask, onAddTask }: { onEditTask: (id: string) => void; onAddTask: (roomId: string) => void }) {
  const now = useNow();
  const rooms = useRooms() ?? [];
  const tasks = useTasks();
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const today = dateStr(new Date(now));

  return (
    <>
      <div className="room-grid">
        {rooms.map((r) => {
          const rt = tasks.filter((t) => t.roomId === r.id);
          const due = rt.filter((t) => isDue(t, today)).length;
          return (
            <button key={r.id} type="button" className="room-card card" onClick={() => setOpenRoom(r.id)}>
              <div className="room-emoji">{roomKindInfo(r.kind).emoji}</div>
              <div className="room-name">{r.name}</div>
              <CleanRing pct={cleanliness(rt, now)} size={54} />
              <div className={`room-due${due ? ' late' : ''}`}>{due ? `${due} due` : `${rt.length} task${rt.length === 1 ? '' : 's'}`}</div>
            </button>
          );
        })}
        <button type="button" className="room-card card add" onClick={() => setAdding(true)}>
          <Plus size={28} /><div className="room-name">Add room</div>
        </button>
      </div>

      {openRoom && (
        <RoomSheet roomId={openRoom} onClose={() => setOpenRoom(null)}
          onEditTask={onEditTask} onAddTask={() => onAddTask(openRoom)} />
      )}
      {adding && <AddRoomSheet order={rooms.length} onClose={() => setAdding(false)} />}
    </>
  );
}

function RoomSheet({ roomId, onClose, onEditTask, onAddTask }: {
  roomId: string; onClose: () => void; onEditTask: (id: string) => void; onAddTask: () => void;
}) {
  const now = useNow();
  const room = useLiveQuery(() => db.rooms.get(roomId), [roomId]);
  const tasks = useTasks().filter((t) => t.roomId === roomId).sort((a, b) => dirtiness(b, now) - dirtiness(a, now));
  const members = useMembers();
  const [renaming, setRenaming] = useState<string | null>(null);
  if (!room) return null;
  const memberById = new Map(members.map((m) => [m.id, m]));
  const today = dateStr(new Date(now));

  async function saveName() {
    if (renaming !== null && renaming.trim()) await db.rooms.update(roomId, { name: renaming.trim(), updatedAt: nowISO() });
    setRenaming(null);
  }

  async function remove() {
    if (!room || !confirm(`Delete ${room.name} and its ${tasks.length} task(s)?`)) return;
    await deleteRoom(roomId);
    onClose();
  }

  return (
    <Sheet title={`${roomKindInfo(room.kind).emoji} ${room.name}`} saveLabel="Done" onClose={onClose} onSave={onClose} onDelete={() => void remove()}>
      <div className="room-head">
        <CleanRing pct={cleanliness(tasks, now)} size={64} />
        {renaming === null ? (
          <button type="button" className="btn ghost small" onClick={() => setRenaming(room.name)}>Rename</button>
        ) : (
          <div className="row-input">
            <input type="text" value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label="Room name" autoFocus />
            <button type="button" className="btn save small" onClick={() => void saveName()}>OK</button>
          </div>
        )}
      </div>
      <div className="list">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} room={undefined} member={t.assigneeId ? memberById.get(t.assigneeId) : undefined}
            today={today} now={now} onDone={() => void completeTask(t)} onOpen={() => onEditTask(t.id)} />
        ))}
        {tasks.length === 0 && <div className="empty small">No tasks yet.</div>}
      </div>
      <div className="sheet-actions">
        <button type="button" className="btn ghost" onClick={onAddTask}><Plus size={16} /> Add task</button>
      </div>
    </Sheet>
  );
}

function AddRoomSheet({ order, onClose }: { order: number; onClose: () => void }) {
  const [kind, setKind] = useState<RoomKind>('bedroom');
  const [name, setName] = useState('');
  const [starter, setStarter] = useState(true);
  const rooms = useRooms() ?? [];

  function defaultName(k: RoomKind) {
    const label = roomKindInfo(k).label;
    const n = rooms.filter((r: Room) => r.kind === k).length;
    return n ? `${label} ${n + 1}` : label;
  }

  async function save() {
    await createRoom(kind, name.trim() || defaultName(kind), order, starter);
    onClose();
  }

  return (
    <Sheet title="Add room" saveLabel="Add" onClose={onClose} onSave={() => void save()}>
      <Field label="Type">
        <ChipSelect options={ROOM_KINDS.map((k) => ({ value: k.kind, label: `${k.emoji} ${k.label}` }))} value={kind} onChange={setKind} />
      </Field>
      <Field label="Name">
        <input type="text" value={name} placeholder={defaultName(kind)} onChange={(e) => setName(e.target.value)} />
      </Field>
      <label className="toggle">
        <input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} /> Add suggested tasks for this room
      </label>
    </Sheet>
  );
}
