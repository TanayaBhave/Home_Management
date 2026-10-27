import Dexie, { type Table } from 'dexie';

// ---- Shared base fields on every synced record ----
export interface BaseRecord {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO — drives sync + last-write-wins
  deleted: number;   // 0 | 1 (indexable boolean)
}

export type RoomKind =
  | 'kitchen' | 'bedroom' | 'bathroom' | 'living' | 'dining' | 'laundry'
  | 'office' | 'entry' | 'kids' | 'garage' | 'outdoor' | 'whole-home' | 'other';

/** 1 = quick (≈5 min), 2 = medium (≈15 min), 3 = big (30+ min). Drives points. */
export type Effort = 1 | 2 | 3;

export interface Member extends BaseRecord {
  name: string;
  color: string; // hex, used for avatar + leaderboard bar
}

export interface Room extends BaseRecord {
  name: string;
  kind: RoomKind;
  order: number;
}

export interface Task extends BaseRecord {
  roomId: string;
  name: string;
  freqDays: number;      // repeats every N days
  effort: Effort;
  assigneeId?: string;   // Member.id; unset = anyone
  remindAt?: string;     // 'HH:MM' — push a reminder at this time on days it's due
  lastDoneAt: string;    // ISO; dirtiness is derived from this + freqDays
  archived: number;      // 0 | 1 — paused tasks never come due
}

export interface Completion extends BaseRecord {
  taskId: string;
  memberId?: string;
  doneAt: string; // ISO
  points: number;
}

// Keep in sync with server/sync.js SYNC_TABLES.
export const SYNC_TABLES = ['members', 'rooms', 'tasks', 'completions'] as const;

class HomeDB extends Dexie {
  members!: Table<Member, string>;
  rooms!: Table<Room, string>;
  tasks!: Table<Task, string>;
  completions!: Table<Completion, string>;

  constructor() {
    super('home-management');
    this.version(1).stores({
      members: 'id, updatedAt, deleted',
      rooms: 'id, updatedAt, deleted, order',
      tasks: 'id, updatedAt, deleted, roomId, assigneeId',
      completions: 'id, updatedAt, deleted, taskId, memberId, doneAt',
    });
  }
}

export const db = new HomeDB();

export function newId(): string {
  return crypto.randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function baseFields(): BaseRecord {
  const now = nowISO();
  return { id: newId(), createdAt: now, updatedAt: now, deleted: 0 };
}

/** Patch a record and bump updatedAt so sync picks it up. */
export async function touch<T extends BaseRecord>(table: Table<T, string>, id: string, patch: Partial<T>) {
  await table.update(id, { ...patch, updatedAt: nowISO() } as never);
}

/** Soft delete (synced as a tombstone). */
export async function softDelete<T extends BaseRecord>(table: Table<T, string>, id: string) {
  await touch(table, id, { deleted: 1 } as Partial<T>);
}

/** Local calendar date 'YYYY-MM-DD'. */
export function dateStr(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- Device-local preferences (localStorage, never synced) ----

export function getMe(): string {
  return localStorage.getItem('meMemberId') ?? '';
}

export function setMe(id: string) {
  localStorage.setItem('meMemberId', id);
}
