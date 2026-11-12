import { ID } from '@gauzy/contracts';
import {
	EMPTY_SELECTION,
	isSelected,
	pageSelectionState,
	retainSelection,
	selectAllOnPage,
	selectRange,
	TaskSelection,
	toggleSelection,
	unselectPage
} from './selection';

const ids = (...names: string[]) => names as ID[];
const ORDER = ids('a', 'b', 'c', 'd', 'e', 'f');

describe('selection model', () => {
	it('toggles a row and makes it the anchor', () => {
		const first = toggleSelection(EMPTY_SELECTION, 'b' as ID, 100);
		expect(first.selection).toEqual({ ids: ['b'], anchor: 'b' });
		const second = toggleSelection(first.selection, 'b' as ID, 100);
		expect(second.selection).toEqual({ ids: [], anchor: 'b' });
		expect(isSelected(first.selection, 'b' as ID)).toBe(true);
	});

	it('refuses a row past the limit and says so, without losing the anchor', () => {
		const full: TaskSelection = { ids: ids('a', 'b'), anchor: 'a' as ID };
		const change = toggleSelection(full, 'c' as ID, 2);
		expect(change.limited).toBe(true);
		expect(change.selection.ids).toEqual(['a', 'b']);
		expect(change.selection.anchor).toBe('c');
		// Unselecting is never limited.
		expect(toggleSelection(full, 'a' as ID, 2)).toEqual({ selection: { ids: ['b'], anchor: 'a' }, limited: false });
	});

	it('selects the range from the anchor to the row Shift-clicked, both ways, keeping the anchor', () => {
		const anchored = toggleSelection(EMPTY_SELECTION, 'b' as ID, 100).selection;
		const down = selectRange(anchored, ORDER, 'e' as ID, 100);
		expect(down.selection).toEqual({ ids: ['b', 'c', 'd', 'e'], anchor: 'b' });
		const up = selectRange(toggleSelection(EMPTY_SELECTION, 'e' as ID, 100).selection, ORDER, 'c' as ID, 100);
		expect(up.selection.ids).toEqual(['e', 'd', 'c']);
		expect(up.selection.anchor).toBe('e');
	});

	it('keeps rows selected elsewhere in a range, and stops at the limit', () => {
		const start: TaskSelection = { ids: ids('f'), anchor: 'a' as ID };
		const change = selectRange(start, ORDER, 'd' as ID, 3);
		expect(change.selection.ids).toEqual(['f', 'a', 'b']);
		expect(change.limited).toBe(true);
	});

	it('toggles the row when there is no anchor on the page, and ignores a row that is not on it', () => {
		expect(selectRange(EMPTY_SELECTION, ORDER, 'c' as ID, 100).selection).toEqual({ ids: ['c'], anchor: 'c' });
		expect(selectRange({ ids: [], anchor: 'zz' as ID }, ORDER, 'c' as ID, 100).selection.ids).toEqual(['c']);
		const same = { ids: ids('a'), anchor: 'a' as ID };
		expect(selectRange(same, ORDER, 'zz' as ID, 100).selection).toBe(same);
	});

	it('selects all on the page up to the limit, and unselects the page only', () => {
		const other: TaskSelection = { ids: ids('x'), anchor: null };
		const all = selectAllOnPage(other, ORDER, 4);
		expect(all.selection.ids).toEqual(['x', 'a', 'b', 'c']);
		expect(all.limited).toBe(true);
		expect(unselectPage(all.selection, ORDER).ids).toEqual(['x']);
	});

	it('tells the page checkbox how much of the page is selected', () => {
		expect(pageSelectionState(EMPTY_SELECTION, ORDER)).toBe('none');
		expect(pageSelectionState({ ids: ids('a'), anchor: null }, ORDER)).toBe('some');
		expect(pageSelectionState({ ids: ORDER, anchor: null }, ORDER)).toBe('all');
		expect(pageSelectionState({ ids: ORDER, anchor: null }, [])).toBe('none');
	});

	it('drops the rows that are gone, and keeps the same selection when none is', () => {
		const selection: TaskSelection = { ids: ids('a', 'b', 'c'), anchor: 'b' as ID };
		expect(retainSelection(selection, ids('a', 'c'))).toEqual({ ids: ['a', 'c'], anchor: null });
		expect(retainSelection(selection, ORDER)).toBe(selection);
	});
});
