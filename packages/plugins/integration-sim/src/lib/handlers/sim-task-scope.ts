import { isTaskSyncAllowed } from '@gauzy/contracts';

/** Deeper than this, an object is dropped rather than sent: a payload Sim gets is never walked only in part. */
const MAX_DEPTH = 12;

/**
 * A payload as Sim (a third-party integration) may see it: every task anywhere in it — a time log's `task`, a
 * `lastWorkedTask`, a parent, children, `linkedIssues[].taskFrom`, `project.tasks`, … — whose sync scope does not
 * allow third parties is reduced to its id. A task is recognised by its `syncScope` key (a loaded task row always
 * carries the column). Cycles are kept as cycles of the reduced copies.
 */
export function redactForSim<T>(value: T): T {
	return walk(value, 0, new Map()) as T;
}

function walk(value: unknown, depth: number, done: Map<object, unknown>): unknown {
	if (!value || typeof value !== 'object' || value instanceof Date) return value;
	if (done.has(value)) return done.get(value);
	if (depth > MAX_DEPTH) return undefined;
	if (Array.isArray(value)) {
		const out: unknown[] = [];
		done.set(value, out);
		for (const item of value) out.push(walk(item, depth + 1, done));
		return out;
	}
	const record = value as Record<string, unknown>;
	if ('syncScope' in record && !isTaskSyncAllowed(record as { syncScope?: string | null }, 'third-party')) {
		const reduced = { id: record['id'] };
		done.set(value, reduced);
		return reduced;
	}
	const out: Record<string, unknown> = {};
	done.set(value, out);
	for (const [key, item] of Object.entries(record)) out[key] = walk(item, depth + 1, done);
	return out;
}
