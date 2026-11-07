/**
 * Task references: the `KEY-number` identifiers chat messages, pages and links name a task by (`API-42`).
 *
 * A project's key is `OrganizationProject.taskKey` when set; before one is set, the key the create path has
 * always derived (the first three characters of the project's name, as `Task.prefix` carries it). A project
 * keeps resolving under its former keys (`taskKeyHistory`) after a rename.
 */

/** A valid project key: letters and digits, upper case, two to ten characters, starting with a letter. */
export const TASK_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

/** A reference inside text: a key, a dash and a number, on word boundaries (`API-42`, `api-42`). */
export const TASK_REFERENCE_PATTERN = /(?<![A-Za-z0-9-])([A-Za-z][A-Za-z0-9]{1,9})-(\d{1,9})(?![A-Za-z0-9-])/g;

/** The most references one resolve request takes. */
export const TASK_REFERENCES_MAX = 50;

export interface ITaskReferenceParts {
	/** The key as written, upper-cased. */
	key: string;
	number: number;
	/** The reference as it was written. */
	reference: string;
}

/** The key, upper-cased and trimmed; null when it is not a valid key. */
export function normalizeTaskKey(value: string | null | undefined): string | null {
	const key = String(value ?? '')
		.trim()
		.toUpperCase();
	return TASK_KEY_PATTERN.test(key) ? key : null;
}

/** Whether a value is a valid project key as written (upper case, the pattern). */
export function isValidTaskKey(value: unknown): boolean {
	return typeof value === 'string' && TASK_KEY_PATTERN.test(value);
}

/**
 * The key the platform derives for a project without one: the first three characters of its name, upper-cased,
 * letters and digits only (`Fulfilment` → `FUL`, `3D Print` → `3DP`). Null for a name too short to make one.
 */
export function derivedProjectKey(name: string | null | undefined): string | null {
	const compact = String(name ?? '')
		.replace(/[^A-Za-z0-9]/g, '')
		.toUpperCase()
		.slice(0, 3);
	return compact.length >= 2 ? compact : null;
}

/** The prefix the create path writes on a task: the first three characters of the project's name, as they are. */
export function derivedTaskPrefix(name: string | null | undefined): string | null {
	const prefix = String(name ?? '').slice(0, 3);
	return prefix.length > 0 ? prefix : null;
}

/** One reference (`API-42`, with or without surrounding text) as its parts; null when the text holds none. */
export function parseTaskReference(text: string | null | undefined): ITaskReferenceParts | null {
	return parseTaskReferences(text)[0] ?? null;
}

/** Every reference in a text, in order, each once. */
export function parseTaskReferences(text: string | null | undefined): ITaskReferenceParts[] {
	const found: ITaskReferenceParts[] = [];
	const seen = new Set<string>();
	const pattern = new RegExp(TASK_REFERENCE_PATTERN.source, 'g');
	const source = String(text ?? '');
	for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
		const key = match[1].toUpperCase();
		const number = Number(match[2]);
		if (!Number.isSafeInteger(number) || number <= 0) continue;
		const id = `${key}-${number}`;
		if (seen.has(id)) continue;
		seen.add(id);
		found.push({ key, number, reference: match[0] });
	}
	return found;
}

/**
 * Every key a project answers to, upper-cased: its key, its former keys, and the derived key of its name (the one
 * tasks created before keys existed are addressed by).
 */
export function keysOfProject(project: { name?: string | null; taskKey?: string | null; taskKeyHistory?: string[] | null }): string[] {
	const keys = new Set<string>();
	const current = normalizeTaskKey(project.taskKey);
	if (current) keys.add(current);
	for (const former of project.taskKeyHistory ?? []) {
		const key = normalizeTaskKey(former);
		if (key) keys.add(key);
	}
	const derived = derivedProjectKey(project.name);
	if (derived) keys.add(derived);
	return [...keys];
}

/**
 * A unique key for a new project among the organization's keys: the derived key, then the derived key with a
 * number (`FUL`, `FUL2`, `FUL3`, …). Null when the name derives no key.
 */
export function uniqueProjectKey(name: string | null | undefined, taken: Iterable<string>): string | null {
	const base = derivedProjectKey(name);
	if (!base) return null;
	const used = new Set([...taken].map((key) => String(key).toUpperCase()));
	if (!used.has(base)) return base;
	for (let suffix = 2; suffix < 1000; suffix += 1) {
		const candidate = `${base}${suffix}`.slice(0, 10);
		if (!used.has(candidate)) return candidate;
	}
	return null;
}
