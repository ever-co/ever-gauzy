import { ID } from '@gauzy/contracts';

/**
 * The id of the project a row names without it, set by a read that answers a project as a few of its fields (its
 * name and image) with no id, so that the project can still be told apart from the others. A symbol, so that no
 * answer carries it: the JSON of a response leaves symbol keys out.
 */
export const PROJECT_ID_OF_ROW = Symbol('projectIdOfRow');

/**
 * A project answered as a few of its fields, with the id of the project kept beside them for
 * {@link withHiddenProjectsWithheld}: invisible to the answer, which reads the same as before.
 *
 * @param fields - The fields the read answers the project as.
 * @param projectId - The project, or none for a row without one.
 */
export function withProjectIdKept<T extends object>(fields: T, projectId: ID | null | undefined): T {
	if (projectId) {
		Object.defineProperty(fields, PROJECT_ID_OF_ROW, { value: projectId, enumerable: false, configurable: true });
	}
	return fields;
}

/**
 * Every project a time entry has been on, kept beside each row of its history by the history read: the one it is on
 * now and each one its recorded changes name. A symbol, so that no answer carries it.
 */
export const PROJECTS_OF_ENTRY = Symbol('projectsOfEntry');

/**
 * A time entry history row with every project its entry has been on kept beside it for
 * {@link withHiddenProjectsWithheld}: a row quotes the name its entry's project had when it was written, so its label
 * is withheld when any of them is hidden from the caller. Invisible to the answer.
 *
 * @param row - The history row.
 * @param projectIds - The projects its entry has been on.
 */
export function withEntryProjectsKept<T extends object>(row: T, projectIds: Iterable<ID>): T {
	Object.defineProperty(row, PROJECTS_OF_ENTRY, { value: [...projectIds], enumerable: false, configurable: true });
	return row;
}

/** How the rows of one route's answer name their project, beyond the `project` relation every row may carry. */
export interface HiddenProjectsOptions {
	/**
	 * The answer is a list of projects, each with some figures of its own (a statistic per project): each hidden one
	 * keeps its id and these figures, and loses every field of the project.
	 */
	readonly rootRowsAreProjects?: { readonly keep: readonly string[] };
	/** Fields of a row that tell something of its project beside it (its budget), withheld with a hidden project. */
	readonly withheldWithProject?: readonly string[];
}

/** A hidden project as every answer names it: its id, and the fact that the caller may not see it. */
export interface IHiddenProjectReference {
	id: ID;
	projectHidden: true;
}

/** The label a time entry's history names it by when it has neither a task nor a project the caller may see. */
const TIME_ENTRY_LABEL = 'time entry';

/** The entity name of a time entry's history rows (activity log rows), as `BaseEntityEnum.TimeLog` states it. */
const TIME_LOG_ENTITY = 'TimeLog';

/** A hidden project as every answer names it. */
function hiddenProjectReference(id: ID): IHiddenProjectReference {
	return { id, projectHidden: true };
}

/** Whether a value is one the walk looks into: an object or an array, but none of the built-in values that hold data. */
function isWalkable(value: unknown): value is object {
	if (value === null || typeof value !== 'object') {
		return false;
	}
	const isBuiltInValue =
		value instanceof Date ||
		value instanceof RegExp ||
		value instanceof Map ||
		value instanceof Set ||
		ArrayBuffer.isView(value) ||
		value instanceof ArrayBuffer;
	return !isBuiltInValue;
}

/** A shallow copy of an object, of the same class, so that the serialization that follows reads it as before. */
function copyOf<T extends object>(value: T): T {
	return Object.assign(Object.create(Object.getPrototypeOf(value)), value);
}

/** The id of a project named by a value: its own id, or the one a read set beside its few fields. */
function projectIdOf(project: unknown): ID | undefined {
	if (!isWalkable(project)) {
		return undefined;
	}
	const own = (project as { id?: unknown }).id;
	if (typeof own === 'string') {
		return own;
	}
	const kept = (project as { [PROJECT_ID_OF_ROW]?: unknown })[PROJECT_ID_OF_ROW];
	if (typeof kept === 'string') {
		return kept;
	}
	return undefined;
}

/**
 * The project a row names through its `project` relation: the relation's id, or, where the relation was read without
 * it, the row's `projectId`. None where the row has no `project` object.
 */
function projectIdOfRow(row: Record<string, unknown>): ID | undefined {
	const project = row['project'];
	if (!isWalkable(project) || Array.isArray(project)) {
		return undefined;
	}
	const own = projectIdOf(project);
	if (own !== undefined) {
		return own;
	}
	const column = row['projectId'];
	if (typeof column === 'string') {
		return column;
	}
	return undefined;
}

/**
 * Walks an answer and withholds every project the caller may not see, the time it holds staying where it is.
 *
 * - The `project` of any row naming a hidden project is answered as `{ id, projectHidden: true }`, and the row loses
 *   the fields `withheldWithProject` names. A row's `project` read without its id is known by the row's `projectId`.
 * - The references a time entry's history keeps (`previousEntities`, `updatedEntities`: `{ projectId: { id, name } }`)
 *   answer a hidden project the same way, and the description of a history row loses its name.
 * - Where the answer is a list of projects (`rootRowsAreProjects`), each hidden one keeps its id and the figures named.
 *
 * Copies only the objects on the way to a change and keeps their class, so the records the services return are never
 * changed, and an answer without a hidden project comes back as the same object.
 *
 * @param answer - The answer of a route.
 * @param hidden - The projects the caller may not see, with their names.
 * @param options - How the route's rows name their project.
 * @returns The answer, with the hidden projects withheld.
 */
export function withHiddenProjectsWithheld<T>(
	answer: T,
	hidden: ReadonlyMap<ID, string>,
	options: HiddenProjectsOptions = {}
): T {
	if (hidden.size === 0) {
		return answer;
	}
	const isHidden = (id: ID | undefined): id is ID => id !== undefined && hidden.has(id);
	const withheldWithProject = options.withheldWithProject ?? [];
	const visiting = new Set<object>();

	const visitProjectRow = (row: object): object => {
		const id = projectIdOf(row);
		if (!isHidden(id)) {
			return visit(row);
		}
		const kept: Record<string, unknown> = { ...hiddenProjectReference(id) };
		for (const field of options.rootRowsAreProjects?.keep ?? []) {
			if (field in row) {
				kept[field] = (row as Record<string, unknown>)[field];
			}
		}
		return kept;
	};

	const visitArray = (rows: unknown[], areProjects: boolean): unknown[] => {
		let changed = false;
		const visited = rows.map((row) => {
			let next: unknown;
			if (areProjects && isWalkable(row)) {
				next = visitProjectRow(row);
			} else {
				next = visit(row);
			}
			if (next !== row) {
				changed = true;
			}
			return next;
		});
		if (changed) {
			return visited;
		}
		return rows;
	};

	const visit = <V>(value: V): V => {
		if (!isWalkable(value) || visiting.has(value)) {
			return value;
		}
		if (Array.isArray(value)) {
			return visitArray(value, false) as V;
		}
		visiting.add(value);
		const record = value as Record<string, unknown>;
		let copy: Record<string, unknown> | undefined;
		const set = (key: string, next: unknown): void => {
			copy ??= copyOf(record);
			copy[key] = next;
		};

		let hiddenRowProjectId: ID | undefined;
		const rowProjectId = projectIdOfRow(record);
		if (isHidden(rowProjectId)) {
			hiddenRowProjectId = rowProjectId;
		}
		const withheld = new Set<string>();
		if (hiddenRowProjectId !== undefined) {
			for (const field of withheldWithProject) {
				if (field in record) {
					withheld.add(field);
				}
			}
		}

		for (const key of Object.keys(record)) {
			if (withheld.has(key)) {
				copy ??= copyOf(record);
				delete copy[key];
				continue;
			}
			const child = record[key];
			const isRowProject = key === 'project' && hiddenRowProjectId !== undefined;
			if (isRowProject) {
				set(key, hiddenProjectReference(hiddenRowProjectId));
				continue;
			}
			if (key === 'projectId') {
				const referencedProjectId = projectIdOf(child);
				if (isHidden(referencedProjectId)) {
					set(key, hiddenProjectReference(referencedProjectId));
					continue;
				}
			}
			const next = visit(child);
			if (next !== child) {
				set(key, next);
			}
		}

		const isTimeEntryHistoryRow = record['entity'] === TIME_LOG_ENTITY && typeof record['description'] === 'string';
		if (isTimeEntryHistoryRow) {
			let description = record['description'] as string;
			// The label quotes the name the entry's project had when the row was written: withheld whatever it was,
			// when any project the entry has been on is hidden
			if (historyRowNamesHiddenProject(record, isHidden)) {
				description = withLabelWithheld(description);
			}
			description = withHiddenProjectNamesOut(description, hidden);
			if (description !== record['description']) {
				set('description', description);
			}
		}

		visiting.delete(value);
		return (copy ?? value) as V;
	};

	if (Array.isArray(answer) && options.rootRowsAreProjects) {
		return visitArray(answer, true) as T;
	}
	return visit(answer);
}

/**
 * Whether a time entry's history row may quote the name of a project hidden from the caller: one of the projects its
 * entry has been on (kept beside the row by the history read) is hidden, or the row's own change names one (an entry
 * deleted for good keeps no project of its own).
 */
function historyRowNamesHiddenProject(
	row: Record<string, unknown>,
	isHidden: (id: ID | undefined) => boolean
): boolean {
	const kept = (row as { [PROJECTS_OF_ENTRY]?: unknown })[PROJECTS_OF_ENTRY];
	if (Array.isArray(kept) && kept.some((projectId) => typeof projectId === 'string' && isHidden(projectId))) {
		return true;
	}
	for (const field of ['updatedValues', 'previousValues']) {
		const values = row[field];
		if (!Array.isArray(values)) {
			continue;
		}
		for (const value of values) {
			const projectId = (value as { projectId?: unknown } | null)?.projectId;
			if (typeof projectId === 'string' && isHidden(projectId)) {
				return true;
			}
		}
	}
	return false;
}

/** A history row's description with its quoted label, the last quoted part, put back to "time entry". */
function withLabelWithheld(description: string): string {
	const end = description.lastIndexOf('"');
	const start = description.lastIndexOf('"', end - 1);
	const hasQuotedLabel = start >= 0 && end > start;
	if (!hasQuotedLabel) {
		return description;
	}
	return `${description.slice(0, start)}"${TIME_ENTRY_LABEL}"${description.slice(end + 1)}`;
}

/**
 * A history row's description with the name of every hidden project, as the row quotes it, put back to the label an
 * entry with neither task nor project gets.
 */
function withHiddenProjectNamesOut(description: string, hidden: ReadonlyMap<ID, string>): string {
	let next = description;
	for (const name of hidden.values()) {
		if (!name) {
			continue;
		}
		next = next.split(`"${name}"`).join(`"${TIME_ENTRY_LABEL}"`);
	}
	return next;
}
