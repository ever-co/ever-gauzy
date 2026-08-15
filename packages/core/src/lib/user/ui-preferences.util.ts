import { IUserUiPreferences, IUserUiPreferencesUpdateInput } from '@gauzy/contracts';

/**
 * Upper bound (bytes of the serialized JSON) for one user's UI preferences blob.
 * The blob is free-form per feature, so this is what keeps a misbehaving client
 * from turning the `user` row into a dumping ground.
 */
export const MAX_UI_PREFERENCES_BYTES = 16 * 1024;

/**
 * Keys that must never be copied from client input into a stored object
 * (prototype pollution).
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * True for a plain JSON object (not null, not an array).
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Coerces whatever is stored on the row (object, JSON string on SQLite, null)
 * into a plain preferences object. Unparseable input yields `{}` rather than
 * throwing so one corrupt row cannot break the user's session.
 */
export function normalizeUiPreferences(stored: unknown): IUserUiPreferences {
	if (typeof stored === 'string') {
		try {
			return normalizeUiPreferences(JSON.parse(stored));
		} catch {
			return {};
		}
	}
	return isPlainObject(stored) ? ({ ...stored } as IUserUiPreferences) : {};
}

/**
 * Validates a `PUT /user/ui-preferences` body beyond what the DTO can express:
 * every top-level entry must map a feature name to a plain object (or `null`,
 * which removes that feature's stored state), and no key may be a prototype
 * accessor. Returns a sanitized copy or throws a plain `Error` with a message
 * suitable for a 400 response.
 */
export function sanitizeUiPreferencesPatch(patch: unknown): IUserUiPreferencesUpdateInput {
	if (!isPlainObject(patch)) {
		throw new Error('uiPreferences patch must be an object keyed by feature');
	}
	const clean: Record<string, unknown> = {};
	for (const [feature, value] of Object.entries(patch)) {
		if (FORBIDDEN_KEYS.has(feature)) {
			throw new Error(`Illegal feature key "${feature}"`);
		}
		if (value === null) {
			clean[feature] = null;
			continue;
		}
		if (!isPlainObject(value)) {
			throw new Error(`Feature "${feature}" must be an object`);
		}
		clean[feature] = assertNoForbiddenKeys(value, feature);
	}
	return clean as IUserUiPreferencesUpdateInput;
}

/** Arrays are walked too: an object nested inside an array is still an object we will store. */
function sanitizeNested(item: unknown, feature: string, depth: number): unknown {
	if (Array.isArray(item)) {
		return item.map((element) => sanitizeNested(element, feature, depth + 1));
	}
	return isPlainObject(item) ? assertNoForbiddenKeys(item as Record<string, unknown>, feature, depth) : item;
}

/**
 * Walks a feature object (bounded depth) and rejects `__proto__` / `constructor` / `prototype`
 * at ANY level — a nested polluting key would survive a shallow check and reach the JSON column,
 * from where a later deep merge could pick it up. Returns a fresh copy (own enumerable keys only).
 */
function assertNoForbiddenKeys(value: Record<string, unknown>, feature: string, depth = 0): Record<string, unknown> {
	if (depth > 8) {
		throw new Error(`Feature "${feature}" is nested too deeply`);
	}
	const copy: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		if (FORBIDDEN_KEYS.has(key)) {
			throw new Error(`Illegal key "${key}" in feature "${feature}"`);
		}
		copy[key] = sanitizeNested(item, feature, depth + 1);
	}
	return copy;
}

/**
 * Shallow merge per top-level feature key: each key present in `patch`
 * REPLACES the whole stored feature object (a `null` value removes it); keys
 * absent from `patch` are kept untouched. Nested fields are deliberately not
 * deep-merged — a feature persists its full state in one write, so a stale
 * nested field can never linger under a newer object.
 *
 * @example
 * merge({ aiChat: { expanded: true, width: 400 }, docs: { zoom: 2 } }, { aiChat: { expanded: false } })
 * // → { aiChat: { expanded: false }, docs: { zoom: 2 } }
 */
export function mergeUiPreferences(current: unknown, patch: IUserUiPreferencesUpdateInput): IUserUiPreferences {
	const merged: Record<string, unknown> = { ...normalizeUiPreferences(current) };
	for (const [feature, value] of Object.entries(patch ?? {})) {
		if (FORBIDDEN_KEYS.has(feature)) {
			continue;
		}
		if (value === null || value === undefined) {
			delete merged[feature];
		} else {
			merged[feature] = value;
		}
	}
	return merged as IUserUiPreferences;
}

/**
 * Serialized size guard for the merged blob.
 */
export function assertUiPreferencesSize(preferences: IUserUiPreferences): void {
	const bytes = Buffer.byteLength(JSON.stringify(preferences), 'utf8');
	if (bytes > MAX_UI_PREFERENCES_BYTES) {
		throw new Error(`uiPreferences exceed ${MAX_UI_PREFERENCES_BYTES} bytes (${bytes})`);
	}
}
