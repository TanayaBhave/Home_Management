import { baseFields, db, getMe, nowISO, type Completion, type Task } from './db';
import { EFFORT_POINTS } from './chores';

export interface UndoToken { completionId: string; taskId: string; prevLastDoneAt: string }

/** Mark a task done: log points for whoever did it and reset its dirtiness. */
export async function completeTask(task: Task, memberId = getMe() || task.assigneeId): Promise<UndoToken> {
  const now = nowISO();
  const c: Completion = {
    ...baseFields(),
    taskId: task.id,
    memberId: memberId || undefined,
    doneAt: now,
    points: EFFORT_POINTS[task.effort],
  };
  await db.transaction('rw', db.tasks, db.completions, async () => {
    await db.completions.add(c);
    await db.tasks.update(task.id, { lastDoneAt: now, updatedAt: now });
  });
  return { completionId: c.id, taskId: task.id, prevLastDoneAt: task.lastDoneAt };
}

export async function undoComplete(u: UndoToken) {
  const now = nowISO();
  await db.transaction('rw', db.tasks, db.completions, async () => {
    await db.completions.update(u.completionId, { deleted: 1, updatedAt: now });
    await db.tasks.update(u.taskId, { lastDoneAt: u.prevLastDoneAt, updatedAt: now });
  });
}

/** Delete a room and everything in it (soft delete so it syncs). */
export async function deleteRoom(roomId: string) {
  const now = nowISO();
  await db.transaction('rw', db.rooms, db.tasks, async () => {
    await db.rooms.update(roomId, { deleted: 1, updatedAt: now });
    await db.tasks.where('roomId').equals(roomId).modify({ deleted: 1, updatedAt: now });
  });
}

/** Remove a member; their tasks become "anyone". Past points stay in history. */
export async function deleteMember(memberId: string) {
  const now = nowISO();
  await db.transaction('rw', db.members, db.tasks, async () => {
    await db.members.update(memberId, { deleted: 1, updatedAt: now });
    await db.tasks.where('assigneeId').equals(memberId).modify({ assigneeId: undefined, updatedAt: now });
  });
}
