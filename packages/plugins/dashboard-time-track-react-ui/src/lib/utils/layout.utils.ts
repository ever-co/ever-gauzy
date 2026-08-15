/**
 * Pure state helpers behind `useDashboardLayout`.
 *
 * The persisted shape is the one the Angular `WidgetService` / `WindowService` write to
 * `Store.widgets` / `Store.windows` (localStorage `_widgets` / `_windows` via Akita persist):
 * an array of `{ position, hide, isCollapse, isExpand, title }` in DISPLAY order, where
 * `position` is the item's identity (its index in the default order, 0..n-1). Reading and
 * writing that exact shape is what lets a tenant flip Angular ↔ React and keep the layout.
 */

/** One widget/window entry of the layout, in display order. */
export interface LayoutItemState {
	/** Identity: index in the default order (0..count-1). */
	position: number;
	/** Hidden via the ⋮ "Delete" action, the Manage-widgets popover or an auto-hide rule. */
	hide: boolean;
	/** Collapsed (`isExpand` is always its inverse, kept for the persisted shape). */
	isCollapse: boolean;
	isExpand: boolean;
	/** Display title Angular stores (innerText of the widget title); informational only. */
	title?: string;
}

/** The persisted record (Angular `GuiDrag.toObject()`), all fields optional on read. */
export type PersistedLayoutItem = Partial<LayoutItemState>;

/**
 * The default layout: `count` items in positional order, visible and expanded.
 *
 * @param count Number of items.
 */
export function createDefaultLayout(count: number): LayoutItemState[] {
	return Array.from({ length: count }, (_, position) => ({
		position,
		hide: false,
		isCollapse: false,
		isExpand: true,
		title: undefined
	}));
}

/**
 * Restores a layout from whatever the store holds.
 *
 * Tolerant on purpose (this is user localStorage): non-arrays yield the default; entries with an
 * out-of-range or duplicate `position` are dropped; positions the store does not mention are
 * appended in default order (so a dashboard that grew a widget still shows it). Stored order
 * wins — it IS the display order.
 *
 * @param stored Raw value from `Store.widgets` / `Store.windows`.
 * @param count Number of items the dashboard has.
 */
export function restoreLayout(stored: unknown, count: number): LayoutItemState[] {
	const defaults = createDefaultLayout(count);
	if (!Array.isArray(stored) || stored.length === 0) return defaults;

	const seen = new Set<number>();
	const restored: LayoutItemState[] = [];
	for (const raw of stored as PersistedLayoutItem[]) {
		const position = Number(raw?.position);
		if (!Number.isInteger(position) || position < 0 || position >= count || seen.has(position)) continue;
		seen.add(position);
		const isCollapse = raw.isCollapse === true || raw.isExpand === false;
		restored.push({
			position,
			hide: raw.hide === true,
			isCollapse,
			isExpand: !isCollapse,
			title: typeof raw.title === 'string' ? raw.title : undefined
		});
	}
	for (const item of defaults) {
		if (!seen.has(item.position)) restored.push(item);
	}
	return restored;
}

/**
 * Serialises the layout into the Angular record shape (`GuiDrag.toObject()`), display order.
 *
 * @param items Current layout.
 * @param titleOf Optional resolver for the informational `title` (Angular stores the rendered
 * title text; the React dashboard passes the translated title).
 */
export function serializeLayout(
	items: LayoutItemState[],
	titleOf?: (position: number) => string | undefined
): PersistedLayoutItem[] {
	return items.map((item) => ({
		position: item.position,
		isCollapse: item.isCollapse,
		isExpand: item.isExpand,
		hide: item.hide,
		title: titleOf ? titleOf(item.position) : item.title
	}));
}

/**
 * Moves the item at `from` to index `to` (CDK `moveItemInArray` semantics). Out-of-range or
 * identical indices return the same array instance.
 *
 * @param items Current layout.
 * @param from Source index (display order).
 * @param to Target index (display order).
 */
export function moveLayoutItem(items: LayoutItemState[], from: number, to: number): LayoutItemState[] {
	if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
	const next = items.slice();
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
}

/**
 * Sets the hidden flag of one item by position; returns the same array when nothing changes.
 *
 * @param items Current layout.
 * @param position Item identity.
 * @param hide New flag.
 */
export function setLayoutHidden(items: LayoutItemState[], position: number, hide: boolean): LayoutItemState[] {
	const index = items.findIndex((item) => item.position === position);
	if (index < 0 || items[index].hide === hide) return items;
	const next = items.slice();
	next[index] = { ...next[index], hide };
	return next;
}

/**
 * Sets the collapsed flag (and its `isExpand` mirror) of one item; same-array on no change.
 *
 * @param items Current layout.
 * @param position Item identity.
 * @param collapsed New flag.
 */
export function setLayoutCollapsed(items: LayoutItemState[], position: number, collapsed: boolean): LayoutItemState[] {
	const index = items.findIndex((item) => item.position === position);
	if (index < 0 || items[index].isCollapse === collapsed) return items;
	const next = items.slice();
	next[index] = { ...next[index], isCollapse: collapsed, isExpand: !collapsed };
	return next;
}

/** True when the item with that position is hidden (unknown positions count as hidden). */
export function isLayoutItemHidden(items: LayoutItemState[], position: number): boolean {
	const item = items.find((entry) => entry.position === position);
	return item ? item.hide : true;
}

/** True when every item is hidden (Angular `_isAllWidgetsHidden`). */
export function isLayoutAllHidden(items: LayoutItemState[]): boolean {
	return items.every((item) => item.hide);
}

/**
 * Memento stack for undo — the React counterpart of Angular's `PersistanceTakers`.
 *
 * Snapshots are pushed BEFORE each mutation and popped by `undo()`; the stack is bounded so a
 * long session cannot grow it without limit.
 */
export class LayoutHistory {
	private readonly snapshots: LayoutItemState[][] = [];

	constructor(private readonly limit = 50) {}

	/** Records the state that a mutation is about to replace. */
	backup(items: LayoutItemState[]): void {
		this.snapshots.push(items.map((item) => ({ ...item })));
		if (this.snapshots.length > this.limit) this.snapshots.shift();
	}

	/** Pops the most recent snapshot, or `undefined` when there is nothing to undo. */
	undo(): LayoutItemState[] | undefined {
		return this.snapshots.pop();
	}

	get canUndo(): boolean {
		return this.snapshots.length > 0;
	}

	get size(): number {
		return this.snapshots.length;
	}
}
