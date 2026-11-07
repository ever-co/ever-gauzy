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
 * The key proposed for a project: the derived key when it is a valid key, else the first three letters of the name
 * (a key starts with a letter: `3D Print` → `DPR`). Null for a name with fewer than two letters or digits.
 */
export function proposedProjectKey(name: string | null | undefined): string | null {
	const derived = derivedProjectKey(name);
	if (derived && isValidTaskKey(derived)) return derived;
	const letters = String(name ?? '')
		.replace(/[^A-Za-z]/g, '')
		.toUpperCase()
		.slice(0, 3);
	return letters.length >= 2 ? letters : null;
}

/**
 * A unique key for a new project among the organization's keys: the proposed key, then the proposed key with a
 * number (`FUL`, `FUL2`, `FUL3`, …). Null when the name proposes no key.
 */
export function uniqueProjectKey(name: string | null | undefined, taken: Iterable<string>): string | null {
	const base = proposedProjectKey(name);
	if (!base) return null;
	const used = new Set([...taken].map((key) => String(key).toUpperCase()));
	if (!used.has(base)) return base;
	for (let suffix = 2; suffix < 1000; suffix += 1) {
		const candidate = `${base}${suffix}`.slice(0, 10);
		if (!used.has(candidate)) return candidate;
	}
	return null;
}

/** Every key a project holds or held (its key and its former keys), upper-cased: what no other project may take. */
export function heldKeysOf(project: { taskKey?: string | null; taskKeyHistory?: string[] | string | null }): string[] {
	const held: string[] = [];
	const current = normalizeTaskKey(project.taskKey);
	if (current) held.push(current);
	let history: unknown = project.taskKeyHistory;
	if (typeof history === 'string') {
		// Stored as JSON text on SQLite.
		try {
			history = JSON.parse(history);
		} catch {
			history = [];
		}
	}
	for (const former of Array.isArray(history) ? history : []) {
		const key = normalizeTaskKey(String(former));
		if (key) held.push(key);
	}
	return held;
}

/**
 * Keys for the projects of one organization that have none, oldest first: each the unique key of its name among
 * every key held in the organization and those given before it. A project whose name proposes no key gets none.
 */
export function assignProjectKeys(
	projects: ReadonlyArray<{ id: string; name?: string | null; taskKey?: string | null; taskKeyHistory?: string[] | string | null }>
): Map<string, string> {
	const taken = new Set(projects.flatMap((project) => heldKeysOf(project)));
	const assigned = new Map<string, string>();
	for (const project of projects) {
		if (normalizeTaskKey(project.taskKey)) continue;
		const key = uniqueProjectKey(project.name, taken);
		if (!key) continue;
		taken.add(key);
		assigned.set(project.id, key);
	}
	return assigned;
}
