// Push reminder opt-in for this device: daily digest time + whose chores to hear about.
import { useEffect, useState } from 'react';
import { ChipSelect, Field } from './Bits';
import { useMembers } from '../hooks';
import {
  currentSubscription, disablePush, enablePush, getPushPrefs, isStandalone, pushSupported,
  savePushPrefs, testPush, type PushPrefs,
} from '../push';

export function ReminderSettings() {
  const members = useMembers();
  const [prefs, setPrefs] = useState<PushPrefs>(getPushPrefs);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { void currentSubscription().then((s) => setOn(!!s)); }, []);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true); setMsg('');
    try { await fn(); setMsg(ok); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  function update(p: PushPrefs) {
    setPrefs(p);
    // Not subscribed yet: savePushPrefs only writes localStorage.
    void run(() => savePushPrefs(p), on ? 'Saved.' : '');
  }

  const supported = pushSupported();

  return (
    <>
      <div className="section-label">Reminders</div>
      {!supported && (
        <div className="hint" style={{ margin: '0 4px 12px' }}>
          {isStandalone() ? 'This browser does not support push notifications.'
            : 'On iPhone: Share → Add to Home Screen, then open the app from its icon to turn on reminders.'}
        </div>
      )}
      <Field label="Daily summary at" hint="One push each morning listing what's due. Leave empty for none.">
        <input type="time" value={prefs.digestTime} onChange={(e) => update({ ...prefs, digestTime: e.target.value })} />
      </Field>
      <Field label="Remind me about">
        <ChipSelect
          options={[{ value: 'all', label: 'Everyone’s tasks' }, ...members.map((m) => ({ value: m.id, label: `${m.name}’s + unassigned` }))]}
          value={prefs.scope}
          onChange={(scope) => update({ ...prefs, scope })}
        />
      </Field>
      <div className="sheet-actions">
        {on ? (
          <>
            <button className="btn ghost" disabled={busy} onClick={() => void run(testPush, 'Test sent — check your notifications.')}>Send test</button>
            <button className="btn ghost" disabled={busy} onClick={() => void run(async () => { await disablePush(); setOn(false); }, 'Reminders off on this device.')}>Turn off</button>
          </>
        ) : (
          <button className="btn save" disabled={busy || !supported} onClick={() => void run(async () => { await enablePush(prefs); setOn(true); }, 'Reminders on.')}>
            Turn on reminders
          </button>
        )}
      </div>
      {msg && <div className="hint" style={{ margin: '8px 4px 0' }}>{msg}</div>}
    </>
  );
}
