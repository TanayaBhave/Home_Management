import { useState } from 'react';
import { Avatar, ChipSelect } from './Bits';
import { ReminderSettings } from './ReminderSettings';
import { SyncSettings } from './SyncSettings';
import { db, getMe, nowISO, setMe } from '../db';
import { useMembers } from '../hooks';
import { deleteMember } from '../actions';
import { addMember } from '../templates';

export function Settings({ onAddRooms }: { onAddRooms: () => void }) {
  const members = useMembers();
  const [me, setMeState] = useState(getMe());
  const [newName, setNewName] = useState('');

  function chooseMe(id: string) {
    setMe(id);
    setMeState(id);
  }

  async function add() {
    if (!newName.trim()) return;
    const m = await addMember(newName.trim());
    if (!me) chooseMe(m.id);
    setNewName('');
  }

  async function rename(id: string, current: string) {
    const name = prompt('Rename', current)?.trim();
    if (name) await db.members.update(id, { name, updatedAt: nowISO() });
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove ${name}? Their tasks become "anyone"; past points stay in history.`)) return;
    await deleteMember(id);
    if (me === id) chooseMe('');
  }

  return (
    <>
      <div className="section-label">This device is</div>
      {members.length > 0
        ? <ChipSelect options={members.map((m) => ({ value: m.id, label: m.name }))} value={me} onChange={chooseMe} />
        : <div className="hint" style={{ margin: '0 4px' }}>Add yourself below.</div>}
      <div className="hint" style={{ margin: '8px 4px 0' }}>Tasks you tick off on this device earn points for this person.</div>

      <div className="section-label">Household</div>
      <div className="list">
        {members.map((m) => (
          <div key={m.id} className="member-row">
            <Avatar member={m} size={28} />
            <span className="member-name">{m.name}</span>
            <button type="button" className="link" onClick={() => void rename(m.id, m.name)}>Rename</button>
            <button type="button" className="link danger" onClick={() => void remove(m.id, m.name)}>Remove</button>
          </div>
        ))}
      </div>
      <div className="row-input" style={{ marginTop: 10 }}>
        <input type="text" placeholder="Add person" value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
        <button type="button" className="btn save small" onClick={() => void add()}>Add</button>
      </div>

      <div className="section-label">Home</div>
      <div className="sheet-actions">
        <button type="button" className="btn ghost" onClick={onAddRooms}>Add rooms by type…</button>
      </div>

      <ReminderSettings />
      <SyncSettings />

      <div className="hint" style={{ margin: '28px 4px 0', textAlign: 'center' }}>Home Management · v{__APP_VERSION__}</div>
    </>
  );
}
