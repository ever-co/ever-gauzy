import { ID, ITask, ITaskReferenceResolution } from '@gauzy/contracts';

/** A valid project key: letters and digits, upper case, two to ten characters, starting with a letter. */
export const TASK_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

/** A reference as someone types it: a key, a dash and a number, a leading `#` allowed (`API-42`, `#api-42`). */
const TYPED_REFERENCE = /^#?([A-Za-z][A-Za-z0-9]{1,9})-(\d{1,9})$/;

/** A task id, as a task link carries it. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A task link of this app (`…/pages/tasks/view/<id>`). */
const TASK_LINK = /\/pages\/tasks\/view\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

/** The fields of a task its reference is made of (`taskNumber` is the API's virtual column: prefix and number). */
export type TaskReferenceSource = Pick<ITask, 'number' | 'prefix'> & {
	taskNumber?: string | null;
	project?: { taskKey?: string | null } | null;
};

/**
 * The reference a task is shown with: the project's key and the task's number (`API-42`) where the project has a
 * key, else what the task has always been shown with (its stored prefix and number). Null when the task has no
 * number.
 */
export function taskReferenceOf(task: TaskReferenceSource | null | undefined): string | null {
	if (!task) return null;
	const number = Number(task.number);
	const hasNumber = Number.isSafeInteger(number) && number > 0;
	const key = String(task.project?.taskKey ?? '').trim();
	if (hasNumber && TASK_KEY_PATTERN.test(key)) return `${key}-${number}`;
	const virtual = String(task.taskNumber ?? '').trim();
	if (virtual) return virtual;
	const prefix = String(task.prefix ?? '').trim();
	if (hasNumber && prefix) return `${prefix}-${number}`;
	return null;
}

/** What the go-to box was given: a reference to resolve, a task id to open as it is, or nothing it understands. */
export type GoToInput =
	| { kind: 'reference'; reference: string; key: string; number: number }
	| { kind: 'id'; id: ID }
	| { kind: 'invalid' };

/** Reads what was typed or pasted into the go-to box: `API-42`, `#api-42`, a task id, or a task link of this app. */
export function parseGoToInput(text: string | null | undefined): GoToInput {
	const value = String(text ?? '').trim();
	if (!value) return { kind: 'invalid' };
	const link = TASK_LINK.exec(value);
	if (link) return { kind: 'id', id: link[1].toLowerCase() as ID };
	if (UUID.test(value)) return { kind: 'id', id: value.toLowerCase() as ID };
	const match = TYPED_REFERENCE.exec(value);
	if (!match) return { kind: 'invalid' };
	const number = Number(match[2]);
	if (!Number.isSafeInteger(number) || number <= 0) return { kind: 'invalid' };
	const key = match[1].toUpperCase();
	return { kind: 'reference', reference: `${key}-${number}`, key, number };
}

/** What a resolution means for the person: open the task (perhaps under its new reference), or say why not. */
export type ReferenceOutcome =
	| { kind: 'open'; taskId: ID; reference: string; title?: string }
	| { kind: 'moved'; taskId: ID; reference: string; current: string; title?: string }
	| { kind: 'ambiguous'; reference: string }
	| { kind: 'not-found'; reference: string };

/** The outcome of one resolution the API answered. */
export function outcomeOfResolution(
	resolution: ITaskReferenceResolution | null | undefined,
	reference: string
): ReferenceOutcome {
	if (!resolution) return { kind: 'not-found', reference };
	if (resolution.ambiguous) return { kind: 'ambiguous', reference };
	if (!resolution.resolved || !resolution.taskId) return { kind: 'not-found', reference };
	const current =
		resolution.currentKey && resolution.currentNumber
			? `${resolution.currentKey}-${resolution.currentNumber}`
			: null;
	if (resolution.formerReference && current && current !== reference) {
		return { kind: 'moved', taskId: resolution.taskId, reference, current, title: resolution.title };
	}
	return { kind: 'open', taskId: resolution.taskId, reference: current ?? reference, title: resolution.title };
}
