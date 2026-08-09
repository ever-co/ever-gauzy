import { DOCS_NARROW_BREAKPOINT_PX, DOCS_TABLE_COLUMNS_KEY } from '../../docs.constants';

/**
 * Column visibility model for the documents table (`01-ux-spec.md` §4.1 column
 * chooser + §14 responsive defaults).
 *
 * Two independent inputs decide whether a column renders:
 *
 * 1. the **stored per-user preference** (`localStorage['gauzy_docs_columns']`), and
 * 2. the **narrow-viewport defaults**, which hide the three low-priority columns
 *    below the `lg` breakpoint.
 *
 * 🛑 They are not the same thing and the order matters: §14 says the narrow
 * defaults are "restorable via column chooser", so an explicit preference — for
 * either direction — always wins over the breakpoint. Baking the breakpoint into
 * the stored map instead would make one narrow session permanently hide those
 * columns on the desktop too.
 */

/** Data keys of the table columns, in render order. `actions` lives in the row kebab. */
export type DocsTableColumnKey =
	| 'name'
	| 'categories'
	| 'tags'
	| 'status'
	| 'knowledge'
	| 'source'
	| 'fileSize'
	| 'updatedAt';

export const DOCS_TABLE_COLUMN_KEYS: readonly DocsTableColumnKey[] = [
	'name',
	'categories',
	'tags',
	'status',
	'knowledge',
	'source',
	'fileSize',
	'updatedAt'
];

/** `DOCS.TABLE.COLUMNS.*` leaf per column — shared by the table header and the chooser. */
export const DOCS_TABLE_COLUMN_TITLE_KEYS: Record<DocsTableColumnKey, string> = {
	name: 'DOCS.TABLE.COLUMNS.NAME',
	categories: 'DOCS.TABLE.COLUMNS.CATEGORIES',
	tags: 'DOCS.TABLE.COLUMNS.TAGS',
	status: 'DOCS.TABLE.COLUMNS.STATUS',
	knowledge: 'DOCS.TABLE.COLUMNS.KNOWLEDGE',
	source: 'DOCS.TABLE.COLUMNS.SOURCE',
	fileSize: 'DOCS.TABLE.COLUMNS.SIZE',
	updatedAt: 'DOCS.TABLE.COLUMNS.UPDATED'
};

/** Name is the row's identity (and the only cell that opens it) — never hideable. */
export const DOCS_TABLE_REQUIRED_COLUMNS: readonly DocsTableColumnKey[] = ['name'];

/** Hidden by default below `DOCS_NARROW_BREAKPOINT_PX` (`01-ux-spec.md` §14). */
export const DOCS_TABLE_NARROW_HIDDEN_COLUMNS: readonly DocsTableColumnKey[] = ['categories', 'tags', 'source'];

/** Stored preferences: only the columns the user actually toggled carry an entry. */
export type DocsTableColumnPreferences = Partial<Record<DocsTableColumnKey, boolean>>;

/** The `localStorage` surface these helpers need — narrowed so tests can pass a stub. */
export type DocsColumnStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * `localStorage` in a try/catch: it throws on access in a sandboxed iframe and in
 * Safari's private mode, and a column preference is never worth an exception.
 */
function defaultStorage(): DocsColumnStorage | null {
	try {
		return typeof localStorage !== 'undefined' ? localStorage : null;
	} catch {
		return null;
	}
}

function isColumnKey(value: string): value is DocsTableColumnKey {
	return (DOCS_TABLE_COLUMN_KEYS as readonly string[]).includes(value);
}

/**
 * Reads the stored preferences, dropping anything that is not a known column /
 * boolean pair. Corrupt or foreign JSON degrades to "no preferences", never to a
 * thrown error that would take the table down with it.
 */
export function readDocsTableColumnPreferences(storage: DocsColumnStorage | null = defaultStorage()): DocsTableColumnPreferences {
	const raw = storage?.getItem(DOCS_TABLE_COLUMNS_KEY);
	if (!raw) return {};
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		const preferences: DocsTableColumnPreferences = {};
		for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
			if (isColumnKey(key) && typeof value === 'boolean') preferences[key] = value;
		}
		return preferences;
	} catch {
		return {};
	}
}

/** Persists the preferences; a failing write (quota, private mode) is not fatal. */
export function writeDocsTableColumnPreferences(
	preferences: DocsTableColumnPreferences,
	storage: DocsColumnStorage | null = defaultStorage()
): void {
	try {
		storage?.setItem(DOCS_TABLE_COLUMNS_KEY, JSON.stringify(preferences));
	} catch {
		// Storage unavailable — the choice still applies to this session.
	}
}

/**
 * Resolves the effective visibility of every column: stored preference first,
 * then the narrow-viewport defaults, then "visible". Required columns are forced
 * on regardless of what a hand-edited storage entry claims.
 */
export function resolveDocsTableColumns(
	preferences: DocsTableColumnPreferences,
	narrow: boolean
): Record<DocsTableColumnKey, boolean> {
	const visibility = {} as Record<DocsTableColumnKey, boolean>;
	for (const key of DOCS_TABLE_COLUMN_KEYS) {
		if (DOCS_TABLE_REQUIRED_COLUMNS.includes(key)) {
			visibility[key] = true;
			continue;
		}
		if (typeof preferences[key] === 'boolean') {
			visibility[key] = preferences[key] as boolean;
			continue;
		}
		visibility[key] = !(narrow && DOCS_TABLE_NARROW_HIDDEN_COLUMNS.includes(key));
	}
	return visibility;
}

/** True when the viewport is below the `lg` breakpoint (`01-ux-spec.md` §14). */
export function isNarrowViewport(width?: number): boolean {
	const resolved = typeof width === 'number' ? width : typeof window !== 'undefined' ? window.innerWidth : undefined;
	return typeof resolved === 'number' && resolved < DOCS_NARROW_BREAKPOINT_PX;
}
