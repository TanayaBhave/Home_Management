// Home setup: how many of each room + who lives here. Shown on first run (no rooms),
// and from Settings → "Add rooms" later. First run also offers joining an existing
// home via sync, so a second phone doesn't create duplicate rooms.
import { useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { Field } from './Bits';
import { SyncSettings } from './SyncSettings';
import { useMembers } from '../hooks';
import { addMember, ROOM_KINDS, setupHome } from '../templates';
import { setMe, type RoomKind } from '../db';

const FIRST_RUN_DEFAULTS: Partial<Record<RoomKind, number>> = {
  kitchen: 1, bedroom: 1, bathroom: 1, living: 1, 'whole-home': 1,
};

export function SetupSheet({ firstRun, roomCount, onClose }: { firstRun: boolean; roomCount: number; onClose?: () => void }) {
  const [counts, setCounts] = useState<Partial<Record<RoomKind, number>>>(firstRun ? FIRST_RUN_DEFAULTS : {});
  const [names, setNames] = useState<string[]>(['']);
  const [mode, setMode] = useState<'new' | 'join'>('new');
  const [busy, setBusy] = useState(false);
  const existingMembers = useMembers();

  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
  const bump = (k: RoomKind, d: number) => setCounts((c) => ({ ...c, [k]: Math.max(0, Math.min(9, (c[k] ?? 0) + d)) }));

  async function create() {
    setBusy(true);
    try {
      if (firstRun) {
        const cleaned = names.map((n) => n.trim()).filter(Boolean);
        for (const [i, n] of cleaned.entries()) {
          const m = await addMember(n);
          if (i === 0 && existingMembers.length === 0) setMe(m.id); // first name = this device's owner
        }
      }
      await setupHome(counts, roomCount);
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={firstRun ? undefined : onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        <div className="sheet-header">
          {onClose ? <button type="button" className="btn ghost" onClick={onClose}>Cancel</button> : <span style={{ width: 60 }} />}
          <h2>{firstRun ? 'Set up your home' : 'Add rooms'}</h2>
          <span style={{ width: 60 }} />
        </div>
        <div className="sheet-body">
          {firstRun && (
            <div className="choices" style={{ marginBottom: 16 }}>
              <button type="button" className={`chip${mode === 'new' ? ' on' : ''}`} onClick={() => setMode('new')}>New home</button>
              <button type="button" className={`chip${mode === 'join' ? ' on' : ''}`} onClick={() => setMode('join')}>Join existing home</button>
            </div>
          )}

          {mode === 'join' ? (
            <>
              <div className="hint" style={{ margin: '0 4px 12px' }}>
                Someone in your household already set things up? Enter the server token — your rooms and tasks will appear once it syncs.
              </div>
              <SyncSettings />
            </>
          ) : (
            <>
              <div className="section-label">Rooms</div>
              <div className="counter-list">
                {ROOM_KINDS.filter((k) => k.kind !== 'other').map((k) => (
                  <div key={k.kind} className="counter">
                    <span className="counter-label">{k.emoji} {k.label}</span>
                    <button type="button" aria-label={`Fewer ${k.label}`} onClick={() => bump(k.kind, -1)}><Minus size={16} /></button>
                    <span className="counter-n" aria-label={`${k.label} count`}>{counts[k.kind] ?? 0}</span>
                    <button type="button" aria-label={`More ${k.label}`} onClick={() => bump(k.kind, 1)}><Plus size={16} /></button>
                  </div>
                ))}
              </div>

              {firstRun && (
                <>
                  <div className="section-label">Who lives here?</div>
                  {names.map((n, i) => (
                    <Field key={i} label={i === 0 ? 'Your name' : `Person ${i + 1}`}>
                      <div className="row-input">
                        <input type="text" value={n} placeholder={i === 0 ? 'e.g. Sam' : 'Name'}
                          onChange={(e) => setNames((a) => a.map((x, j) => (j === i ? e.target.value : x)))} />
                        {i > 0 && (
                          <button type="button" className="btn ghost small" aria-label="Remove" onClick={() => setNames((a) => a.filter((_, j) => j !== i))}><X size={16} /></button>
                        )}
                      </div>
                    </Field>
                  ))}
                  <button type="button" className="chip" onClick={() => setNames((a) => [...a, ''])}><Plus size={14} /> Add person</button>
                </>
              )}

              <div className="sheet-actions" style={{ marginTop: 20 }}>
                <button type="button" className="btn save" disabled={busy || total === 0} onClick={() => void create()}>
                  {firstRun ? `Create ${total} room${total === 1 ? '' : 's'}` : `Add ${total} room${total === 1 ? '' : 's'}`}
                </button>
              </div>
              <div className="hint" style={{ margin: '10px 4px 0' }}>Each room comes with suggested chores — edit or delete any of them later.</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
