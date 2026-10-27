import { isTaskSyncAllowed } from '@gauzy/contracts';

type MaybeTask = { id?: string; syncScope?: string | null } | null | undefined;

/**
 * A task as Sim (a third-party integration) may see it: whole when its sync scope allows third parties, else only
 * its id — a task private to the Ever platform never reaches Sim with its title, description or other fields.
 */
export function taskForSim(task: MaybeTask): MaybeTask {
	return task && !isTaskSyncAllowed(task, 'third-party') ? { id: task.id } : task;
}

/** A time log (or any record carrying a loaded `task`) with that task reduced by `taskForSim`. */
export function withTaskForSim<T>(record: T): T {
	const task = (record as { task?: MaybeTask } | null | undefined)?.task;
	return task ? ({ ...(record as object), task: taskForSim(task) } as T) : record;
}
