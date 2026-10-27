// Room kinds + their starter chores, used by home setup and "Add task" suggestions.
import { baseFields, db, type Effort, type Room, type RoomKind, type Task } from './db';

export interface TaskTemplate { name: string; freqDays: number; effort: Effort }

export const ROOM_KINDS: { kind: RoomKind; label: string; emoji: string }[] = [
  { kind: 'kitchen', label: 'Kitchen', emoji: '🍳' },
  { kind: 'bedroom', label: 'Bedroom', emoji: '🛏️' },
  { kind: 'bathroom', label: 'Bathroom', emoji: '🛁' },
  { kind: 'living', label: 'Living room', emoji: '🛋️' },
  { kind: 'dining', label: 'Dining room', emoji: '🍽️' },
  { kind: 'laundry', label: 'Laundry', emoji: '🧺' },
  { kind: 'office', label: 'Office', emoji: '💻' },
  { kind: 'kids', label: 'Kids room', emoji: '🧸' },
  { kind: 'entry', label: 'Entryway', emoji: '🚪' },
  { kind: 'garage', label: 'Garage', emoji: '🚗' },
  { kind: 'outdoor', label: 'Balcony / Yard', emoji: '🌿' },
  { kind: 'whole-home', label: 'Whole home', emoji: '🏠' },
  { kind: 'other', label: 'Other', emoji: '📦' },
];

export function roomKindInfo(kind: RoomKind) {
  return ROOM_KINDS.find((k) => k.kind === kind) ?? ROOM_KINDS[ROOM_KINDS.length - 1];
}

export const TEMPLATES: Record<RoomKind, TaskTemplate[]> = {
  kitchen: [
    { name: 'Do the dishes', freqDays: 1, effort: 2 },
    { name: 'Wipe counters', freqDays: 1, effort: 1 },
    { name: 'Take out trash', freqDays: 2, effort: 1 },
    { name: 'Clean stovetop', freqDays: 7, effort: 2 },
    { name: 'Mop floor', freqDays: 7, effort: 2 },
    { name: 'Clean microwave', freqDays: 14, effort: 1 },
    { name: 'Clean out fridge', freqDays: 30, effort: 3 },
    { name: 'Clean oven', freqDays: 90, effort: 3 },
  ],
  bedroom: [
    { name: 'Make the bed', freqDays: 1, effort: 1 },
    { name: 'Change bed sheets', freqDays: 7, effort: 2 },
    { name: 'Vacuum floor', freqDays: 7, effort: 2 },
    { name: 'Dust surfaces', freqDays: 14, effort: 1 },
    { name: 'Tidy closet', freqDays: 30, effort: 2 },
    { name: 'Flip / rotate mattress', freqDays: 90, effort: 2 },
  ],
  bathroom: [
    { name: 'Wipe sink & counter', freqDays: 3, effort: 1 },
    { name: 'Clean toilet', freqDays: 7, effort: 2 },
    { name: 'Clean mirror', freqDays: 7, effort: 1 },
    { name: 'Scrub shower / tub', freqDays: 7, effort: 3 },
    { name: 'Replace towels', freqDays: 7, effort: 1 },
    { name: 'Mop floor', freqDays: 7, effort: 2 },
    { name: 'Wash bath mat', freqDays: 14, effort: 1 },
  ],
  living: [
    { name: 'Tidy up', freqDays: 1, effort: 1 },
    { name: 'Vacuum floor', freqDays: 7, effort: 2 },
    { name: 'Dust surfaces', freqDays: 7, effort: 1 },
    { name: 'Vacuum sofa', freqDays: 30, effort: 2 },
    { name: 'Clean windows', freqDays: 90, effort: 3 },
  ],
  dining: [
    { name: 'Wipe table', freqDays: 1, effort: 1 },
    { name: 'Sweep floor', freqDays: 7, effort: 1 },
    { name: 'Wipe chairs', freqDays: 30, effort: 1 },
  ],
  laundry: [
    { name: 'Do laundry', freqDays: 3, effort: 2 },
    { name: 'Fold & put away', freqDays: 3, effort: 2 },
    { name: 'Clean lint trap', freqDays: 7, effort: 1 },
    { name: 'Clean washing machine', freqDays: 30, effort: 2 },
  ],
  office: [
    { name: 'Tidy desk', freqDays: 7, effort: 1 },
    { name: 'Vacuum floor', freqDays: 7, effort: 2 },
    { name: 'Dust electronics', freqDays: 14, effort: 1 },
  ],
  kids: [
    { name: 'Pick up toys', freqDays: 1, effort: 1 },
    { name: 'Change bed sheets', freqDays: 7, effort: 2 },
    { name: 'Vacuum floor', freqDays: 7, effort: 2 },
    { name: 'Sanitize toys', freqDays: 30, effort: 2 },
  ],
  entry: [
    { name: 'Organize shoes', freqDays: 7, effort: 1 },
    { name: 'Sweep floor', freqDays: 7, effort: 1 },
    { name: 'Shake out doormat', freqDays: 14, effort: 1 },
  ],
  garage: [
    { name: 'Sweep floor', freqDays: 30, effort: 2 },
    { name: 'Organize shelves', freqDays: 90, effort: 3 },
  ],
  outdoor: [
    { name: 'Water plants', freqDays: 2, effort: 1 },
    { name: 'Sweep', freqDays: 7, effort: 1 },
    { name: 'Wipe outdoor furniture', freqDays: 30, effort: 2 },
  ],
  'whole-home': [
    { name: 'Empty all trash bins', freqDays: 7, effort: 1 },
    { name: 'Water houseplants', freqDays: 7, effort: 1 },
    { name: 'Wipe light switches & handles', freqDays: 14, effort: 1 },
    { name: 'Replace HVAC filter', freqDays: 90, effort: 1 },
    { name: 'Test smoke alarms', freqDays: 180, effort: 1 },
  ],
  other: [],
};

export const MEMBER_COLORS = ['#0E7C66', '#D9822B', '#7C5CC4', '#C2416B', '#2F7FC1', '#8A9A2B'];

/**
 * Create one room (plus its starter chores). Tasks start staggered "partly dirty"
 * so day one isn't a wall of everything-due-at-once.
 */
export async function createRoom(kind: RoomKind, name: string, order: number, withTasks = true): Promise<Room> {
  const room: Room = { ...baseFields(), name, kind, order };
  const now = Date.now();
  const tasks: Task[] = withTasks
    ? TEMPLATES[kind].map((t, i) => ({
        ...baseFields(),
        roomId: room.id,
        name: t.name,
        freqDays: t.freqDays,
        effort: t.effort,
        archived: 0,
        // Spread starting dirtiness between 30% and ~95%.
        lastDoneAt: new Date(now - (0.3 + ((i * 0.37) % 0.65)) * t.freqDays * 86_400_000).toISOString(),
      }))
    : [];
  await db.transaction('rw', db.rooms, db.tasks, async () => {
    await db.rooms.add(room);
    if (tasks.length) await db.tasks.bulkAdd(tasks);
  });
  return room;
}

/** Home setup: counts per room kind → rooms named "Bedroom 1", "Bedroom 2"… */
export async function setupHome(counts: Partial<Record<RoomKind, number>>, startOrder = 0) {
  let order = startOrder;
  const existing = await db.rooms.filter((r) => !r.deleted).toArray();
  for (const { kind, label } of ROOM_KINDS) {
    const n = counts[kind] ?? 0;
    const already = existing.filter((r) => r.kind === kind).length;
    for (let i = 0; i < n; i++) {
      const idx = already + i + 1;
      const name = n + already > 1 ? `${label} ${idx}` : label;
      await createRoom(kind, name, order++);
    }
  }
}

export async function addMember(name: string) {
  const count = await db.members.filter((m) => !m.deleted).count();
  const m = { ...baseFields(), name, color: MEMBER_COLORS[count % MEMBER_COLORS.length] };
  await db.members.add(m);
  return m;
}
