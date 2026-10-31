import { IQuickActionsUiPreferences } from '@gauzy/contracts';
import { IQuickActionDefinition, QUICK_ACTION_DEFINITIONS } from './quick-action.definitions';
import { checkShortcut, normalizeShortcut, shortcutsConflict } from './quick-action-shortcut.util';

/**
 * Pure helpers that merge the built-in Quick Actions with a user's saved customization
 * (`IUserUiPreferences.quickActions`) and turn an edited layout back into the overrides to save.
 *
 * The saved object only holds what differs from the defaults, and every reader here tolerates
 * anything: ids of actions that no longer exist are ignored, actions added after the user saved
 * appear (in their default place, with their default shortcut unless the user already gave that
 * combination to another action), and malformed values fall back to the defaults. No saved object
 * gives exactly the built-in order and shortcuts.
 */

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (record: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(record, key);

/**
 * Reads a stored `quickActions` value into a clean preferences object: only known action ids, no
 * duplicates in the order, shortcuts in canonical spelling, and only shortcuts a user could have
 * recorded (`''` = removed). `null` when nothing usable is stored.
 */
export function sanitizeQuickActionsPreferences(
	stored: unknown,
	definitions: ReadonlyArray<IQuickActionDefinition> = QUICK_ACTION_DEFINITIONS
): IQuickActionsUiPreferences | null {
	if (!isPlainObject(stored)) {
		return null;
	}
	const known = new Set(definitions.map(({ id }) => id));
	const preferences: IQuickActionsUiPreferences = {};

	if (Array.isArray(stored['order'])) {
		const order = [
			...new Set(stored['order'].filter((id): id is string => typeof id === 'string' && known.has(id)))
		];
		if (order.length) {
			preferences.order = order;
		}
	}

	if (isPlainObject(stored['shortcuts'])) {
		const shortcuts: Record<string, string> = {};
		for (const [id, value] of Object.entries(stored['shortcuts'])) {
			if (!known.has(id) || typeof value !== 'string') {
				continue;
			}
			const shortcut = normalizeShortcut(value);
			if (shortcut === '' || !checkShortcut(shortcut)) {
				shortcuts[id] = shortcut;
			}
		}
		if (Object.keys(shortcuts).length) {
			preferences.shortcuts = shortcuts;
		}
	}

	return preferences.order || preferences.shortcuts ? preferences : null;
}

/**
 * The effective shortcut of every action (action id → canonical shortcut, `''` for none), in
 * definition order.
 *
 * The user's own choices win; each default then applies unless it clashes with a combination
 * already taken. A saved shortcut that breaks the rules or clashes with an earlier one is ignored,
 * so the action falls back to its default.
 */
export function resolveQuickActionShortcuts(
	preferences: IQuickActionsUiPreferences | null | undefined,
	definitions: ReadonlyArray<IQuickActionDefinition> = QUICK_ACTION_DEFINITIONS
): Record<string, string> {
	const overrides = preferences?.shortcuts ?? {};
	const chosen = new Map<string, string>();
	const taken: string[] = [];
	const isFree = (shortcut: string) => !taken.some((other) => shortcutsConflict(shortcut, other));

	for (const { id } of definitions) {
		if (!hasOwn(overrides, id)) {
			continue;
		}
		const shortcut = normalizeShortcut(overrides[id]);
		if (shortcut === '') {
			chosen.set(id, '');
		} else if (!checkShortcut(shortcut) && isFree(shortcut)) {
			chosen.set(id, shortcut);
			taken.push(shortcut);
		}
	}

	const shortcuts: Record<string, string> = {};
	for (const { id, shortcut } of definitions) {
		if (chosen.has(id)) {
			shortcuts[id] = chosen.get(id);
			continue;
		}
		const fallback = normalizeShortcut(shortcut);
		if (fallback && isFree(fallback)) {
			shortcuts[id] = fallback;
			taken.push(fallback);
		} else {
			shortcuts[id] = '';
		}
	}
	return shortcuts;
}

/**
 * The effective order of every action: the saved order (known ids only), then every action it does
 * not list, in default order.
 */
export function resolveQuickActionOrder(
	preferences: IQuickActionsUiPreferences | null | undefined,
	definitions: ReadonlyArray<IQuickActionDefinition> = QUICK_ACTION_DEFINITIONS
): string[] {
	const ids = definitions.map(({ id }) => id);
	const known = new Set(ids);
	const saved = [...new Set((preferences?.order ?? []).filter((id) => known.has(id)))];
	const listed = new Set(saved);
	return [...saved, ...ids.filter((id) => !listed.has(id))];
}

/**
 * `items` sorted by their action's place in `order` (stable; items whose id is not in `order` keep
 * their relative order after the others).
 */
export function sortByQuickActionOrder<T>(
	items: ReadonlyArray<T>,
	order: ReadonlyArray<string>,
	getId: (item: T) => string | undefined
): T[] {
	const rank = new Map(order.map((id, index) => [id, index]));
	const rankOf = (item: T) => rank.get(getId(item) ?? '') ?? Number.MAX_SAFE_INTEGER;
	return [...items].sort((a, b) => rankOf(a) - rankOf(b));
}

/**
 * Puts the ids of `subset` in the given order into the slots they already occupy in `order`; every
 * other id keeps its place. This is how reordering the actions a user can see leaves the place of
 * the ones they cannot see (no permission) untouched.
 */
export function reorderSubset(order: ReadonlyArray<string>, subset: ReadonlyArray<string>): string[] {
	const present = new Set(order);
	const reordered = [...new Set(subset)].filter((id) => present.has(id));
	const members = new Set(reordered);
	let next = 0;
	return order.map((id) => (members.has(id) ? reordered[next++] : id));
}

/** True when both orders put the actions of every group in the same sequence. */
function sameOrderWithinGroups(
	first: ReadonlyArray<string>,
	second: ReadonlyArray<string>,
	definitions: ReadonlyArray<IQuickActionDefinition>
): boolean {
	const groupOf = new Map(definitions.map(({ id, group }) => [id, group]));
	const sequence = (order: ReadonlyArray<string>) =>
		[...new Set(groupOf.values())].map((group) => order.filter((id) => groupOf.get(id) === group).join(','));
	const [a, b] = [sequence(first), sequence(second)];
	return a.every((value, index) => value === b[index]);
}

/**
 * The preferences to save for an edited layout: `order` only when some group's sequence differs
 * from the default, `shortcuts` only for the actions whose shortcut differs from their default (an
 * action missing from `shortcuts` keeps its default). `null` when the layout is the default one,
 * which removes the stored customization.
 */
export function toQuickActionsPreferences(
	order: ReadonlyArray<string>,
	shortcuts: Readonly<Record<string, string>>,
	definitions: ReadonlyArray<IQuickActionDefinition> = QUICK_ACTION_DEFINITIONS
): IQuickActionsUiPreferences | null {
	const preferences: IQuickActionsUiPreferences = {};

	const effectiveOrder = resolveQuickActionOrder({ order: [...order] }, definitions);
	const defaultOrder = definitions.map(({ id }) => id);
	if (!sameOrderWithinGroups(effectiveOrder, defaultOrder, definitions)) {
		preferences.order = effectiveOrder;
	}

	const overrides: Record<string, string> = {};
	for (const { id, shortcut } of definitions) {
		const fallback = normalizeShortcut(shortcut);
		const value = hasOwn(shortcuts, id) ? normalizeShortcut(shortcuts[id]) : fallback;
		if (value !== fallback) {
			overrides[id] = value;
		}
	}
	if (Object.keys(overrides).length) {
		preferences.shortcuts = overrides;
	}

	return preferences.order || preferences.shortcuts ? preferences : null;
}
