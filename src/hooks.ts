import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Completion, type Member, type Room, type Task } from './db';

const EMPTY: never[] = [];

export function useMembers(): Member[] {
  return useLiveQuery(() => db.members.filter((m) => !m.deleted).sortBy('createdAt'), []) ?? EMPTY;
}

export function useRooms(): Room[] | undefined {
  return useLiveQuery(() => db.rooms.orderBy('order').filter((r) => !r.deleted).toArray(), []);
}

export function useTasks(): Task[] {
  return useLiveQuery(() => db.tasks.filter((t) => !t.deleted).toArray(), []) ?? EMPTY;
}

export function useCompletions(sinceISO: string): Completion[] {
  return useLiveQuery(
    () => db.completions.where('doneAt').aboveOrEqual(sinceISO).filter((c) => !c.deleted).reverse().sortBy('doneAt'),
    [sinceISO],
  ) ?? EMPTY;
}

/** Re-render every minute so dirtiness meters creep up while the app is open. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
