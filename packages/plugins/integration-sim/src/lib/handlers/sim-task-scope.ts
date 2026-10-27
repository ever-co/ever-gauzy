import { isTaskSyncAllowed } from '@gauzy/contracts';

type MaybeTask = { id?: string; syncScope?: string | null } | null | undefined;

/**
 * A task as Sim (a third-party integration) may see it: whole when its sync scope allows third parties, else only
 * its id — a task private to the Ever platform never reaches Sim with its title, description or other fields.
 */
export function taskForSim(task: MaybeTask): MaybeTask {
	if (!task) return task;
	if (!isTaskSyncAllowed(task, 'third-party')) return { id: task.id };
	// An allowed task can carry a loaded parent / children: each is reduced by its own scope.
	const graph = task as { parent?: MaybeTask; children?: MaybeTask[] };
	return {
		...task,
		...(graph.parent ? { parent: taskForSim(graph.parent) } : {}),
		...(Array.isArray(graph.children) ? { children: graph.children.map(taskForSim) } : {})
	} as MaybeTask;
}

/** A time log (or any record carrying a loaded `task`) with that task reduced by `taskForSim`. */
export function withTaskForSim<T>(record: T): T {
	const task = (record as { task?: MaybeTask } | null | undefined)?.task;
	return task ? ({ ...(record as object), task: taskForSim(task) } as T) : record;
}
