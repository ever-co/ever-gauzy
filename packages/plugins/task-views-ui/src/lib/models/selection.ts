import { ID } from '@gauzy/contracts';

/**
 * The tasks selected on the page: their ids in the order they were selected, and the anchor a Shift-click range
 * starts from (the row last clicked or toggled without Shift). Immutable: every change answers a new selection.
 */
export interface TaskSelection {
	readonly ids: readonly ID[];
	readonly anchor: ID | null;
}

/** A change to the selection, and whether the limit kept some rows out of it. */
export interface SelectionChange {
	selection: TaskSelection;
	/** Rows that would have been selected but were not: the selection was full. */
	limited: boolean;
}

export const EMPTY_SELECTION: TaskSelection = Object.freeze({ ids: Object.freeze([]) as readonly ID[], anchor: null });

/** Whether a task is selected. */
export function isSelected(selection: TaskSelection, id: ID): boolean {
	return selection.ids.includes(id);
}

/** Selects the row, or unselects it when it is selected; the row becomes the anchor either way. */
export function toggleSelection(selection: TaskSelection, id: ID, limit: number): SelectionChange {
	if (isSelected(selection, id)) {
		return { selection: { ids: selection.ids.filter((selected) => selected !== id), anchor: id }, limited: false };
	}
	if (selection.ids.length >= limit) {
		return { selection: { ...selection, anchor: id }, limited: true };
	}
	return { selection: { ids: [...selection.ids, id], anchor: id }, limited: false };
}

/**
 * A Shift-click: selects every row from the anchor to the row clicked, both included, in the order the page shows
 * them (the anchor stays, so the next Shift-click ranges from it again). Rows already selected stay selected; rows
 * past the limit are left out. Without an anchor on the page, it is a toggle of the row.
 */
export function selectRange(selection: TaskSelection, order: readonly ID[], to: ID, limit: number): SelectionChange {
	const end = order.indexOf(to);
	const start = selection.anchor === null ? -1 : order.indexOf(selection.anchor);
	if (end < 0) return { selection, limited: false };
	if (start < 0) return toggleSelection(selection, to, limit);
	const [from, until] = start <= end ? [start, end] : [end, start];
	const range = order.slice(from, until + 1);
	const result = addAll(selection, start <= end ? range : [...range].reverse(), limit);
	return { selection: { ...result.selection, anchor: selection.anchor }, limited: result.limited };
}

/** Selects every row of the page (up to the limit), keeping what was selected on other pages. */
export function selectAllOnPage(selection: TaskSelection, order: readonly ID[], limit: number): SelectionChange {
	return addAll(selection, order, limit);
}

/** Unselects every row of the page, keeping what was selected elsewhere. */
export function unselectPage(selection: TaskSelection, order: readonly ID[]): TaskSelection {
	const page = new Set(order);
	return {
		ids: selection.ids.filter((id) => !page.has(id)),
		anchor: selection.anchor && page.has(selection.anchor) ? null : selection.anchor
	};
}

/** How much of the page is selected: what the "select all" checkbox shows. */
export function pageSelectionState(selection: TaskSelection, order: readonly ID[]): 'all' | 'some' | 'none' {
	if (!order.length) return 'none';
	const selected = order.filter((id) => selection.ids.includes(id)).length;
	if (selected === 0) return 'none';
	return selected === order.length ? 'all' : 'some';
}

/** The selection without the rows that are gone (deleted, or no longer in the view). */
export function retainSelection(selection: TaskSelection, present: readonly ID[]): TaskSelection {
	const kept = new Set(present);
	const ids = selection.ids.filter((id) => kept.has(id));
	const anchor = selection.anchor && kept.has(selection.anchor) ? selection.anchor : null;
	return ids.length === selection.ids.length && anchor === selection.anchor ? selection : { ids, anchor };
}

function addAll(selection: TaskSelection, candidates: readonly ID[], limit: number): SelectionChange {
	const ids = [...selection.ids];
	const present = new Set(ids);
	let limited = false;
	for (const id of candidates) {
		if (present.has(id)) continue;
		if (ids.length >= limit) {
			limited = true;
			break;
		}
		ids.push(id);
		present.add(id);
	}
	return { selection: { ids, anchor: selection.anchor }, limited };
}
