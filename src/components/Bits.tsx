// Small shared UI pieces: form field wrapper, chip pickers, avatar, dirt meter.
import type { ReactNode } from 'react';
import { dirtLevel } from '../chores';
import type { Member } from '../db';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function ChipSelect<T extends string | number>({
  options, value, onChange,
}: {
  options: { value: T; label: ReactNode }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="choices">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={`chip${o.value === value ? ' on' : ''}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ member, size = 24 }: { member?: Member; size?: number }) {
  if (!member) return null;
  return (
    <span
      className="avatar"
      title={member.name}
      style={{ background: member.color, width: size, height: size, fontSize: size * 0.45 }}
    >
      {member.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Horizontal bar: full = clean, empty/red = dirty. */
export function DirtMeter({ dirt }: { dirt: number }) {
  const clean = Math.max(0, 1 - Math.min(1, dirt));
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clean * 100)} aria-label="Cleanliness">
      <div className={`meter-fill lvl-${dirtLevel(dirt)}`} style={{ width: `${Math.max(4, clean * 100)}%` }} />
    </div>
  );
}

export function CleanRing({ pct, size = 64 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const lvl = pct >= 70 ? 'clean' : pct >= 40 ? 'ok' : 'overdue';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" aria-label={`${pct}% clean`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={7} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} strokeLinecap="round"
        className={`ring-fill lvl-${lvl}`}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="ring-text" fontSize={size * 0.26}>{pct}%</text>
    </svg>
  );
}
