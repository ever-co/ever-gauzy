import {
	createDefaultLayout,
	isLayoutAllHidden,
	isLayoutItemHidden,
	LayoutHistory,
	moveLayoutItem,
	restoreLayout,
	serializeLayout,
	setLayoutCollapsed,
	setLayoutHidden
} from './layout.utils';

describe('layout.utils — persisted layout (Store.widgets / Store.windows shape)', () => {
	it('creates a visible, expanded default layout in positional order', () => {
		const layout = createDefaultLayout(3);
		expect(layout.map((item) => item.position)).toEqual([0, 1, 2]);
		expect(layout.every((item) => !item.hide && item.isExpand && !item.isCollapse)).toBe(true);
	});

	it('restores the default when nothing (or garbage) is stored', () => {
		expect(restoreLayout(null, 6)).toEqual(createDefaultLayout(6));
		expect(restoreLayout(undefined, 6)).toEqual(createDefaultLayout(6));
		expect(restoreLayout('nope', 6)).toEqual(createDefaultLayout(6));
		expect(restoreLayout([], 6)).toEqual(createDefaultLayout(6));
	});

	it('keeps the STORED order (Angular writes display order), flags and titles', () => {
		const stored = [
			{ position: 2, hide: true, isCollapse: false, isExpand: true, title: 'Two' },
			{ position: 0, hide: false, isCollapse: true, isExpand: false, title: 'Zero' },
			{ position: 1, hide: false, isCollapse: false, isExpand: true }
		];
		const layout = restoreLayout(stored, 3);
		expect(layout.map((item) => item.position)).toEqual([2, 0, 1]);
		expect(layout[0]).toMatchObject({ hide: true, isCollapse: false, isExpand: true, title: 'Two' });
		expect(layout[1]).toMatchObject({ hide: false, isCollapse: true, isExpand: false, title: 'Zero' });
	});

	it('drops out-of-range / duplicate entries and appends missing positions', () => {
		const stored = [{ position: 9 }, { position: 1, hide: true }, { position: 1 }, { position: 'x' }];
		const layout = restoreLayout(stored, 4);
		expect(layout.map((item) => item.position)).toEqual([1, 0, 2, 3]);
		expect(layout[0].hide).toBe(true);
	});

	it('treats `isExpand: false` as collapsed when `isCollapse` is missing', () => {
		expect(restoreLayout([{ position: 0, isExpand: false }], 1)[0]).toMatchObject({ isCollapse: true, isExpand: false });
	});

	it('serialises exactly the GuiDrag.toObject() record, in display order', () => {
		const layout = restoreLayout([{ position: 1 }, { position: 0, hide: true }], 2);
		const serialized = serializeLayout(layout, (position) => `Title ${position}`);
		expect(serialized).toEqual([
			{ position: 1, isCollapse: false, isExpand: true, hide: false, title: 'Title 1' },
			{ position: 0, isCollapse: false, isExpand: true, hide: true, title: 'Title 0' }
		]);
		// Without a resolver the stored title is kept.
		expect(serializeLayout(restoreLayout([{ position: 0, title: 'kept' }], 1))[0].title).toBe('kept');
	});
});

describe('layout.utils — transitions', () => {
	const base = createDefaultLayout(4);

	it('moves like CDK moveItemInArray and returns the same array for no-ops', () => {
		expect(moveLayoutItem(base, 0, 2).map((item) => item.position)).toEqual([1, 2, 0, 3]);
		expect(moveLayoutItem(base, 3, 0).map((item) => item.position)).toEqual([3, 0, 1, 2]);
		expect(moveLayoutItem(base, 1, 1)).toBe(base);
		expect(moveLayoutItem(base, -1, 1)).toBe(base);
		expect(moveLayoutItem(base, 0, 4)).toBe(base);
	});

	it('hides / shows by POSITION (not index) and is referentially stable on no change', () => {
		const moved = moveLayoutItem(base, 0, 3); // positions [1,2,3,0]
		const hidden = setLayoutHidden(moved, 0, true);
		expect(hidden[3]).toMatchObject({ position: 0, hide: true });
		expect(hidden[0].hide).toBe(false);
		expect(setLayoutHidden(hidden, 0, true)).toBe(hidden);
		expect(setLayoutHidden(hidden, 42, true)).toBe(hidden);
		expect(isLayoutItemHidden(hidden, 0)).toBe(true);
		expect(isLayoutItemHidden(hidden, 1)).toBe(false);
		expect(isLayoutItemHidden(hidden, 42)).toBe(true);
	});

	it('collapses with the isExpand mirror kept in sync', () => {
		const collapsed = setLayoutCollapsed(base, 2, true);
		expect(collapsed[2]).toMatchObject({ isCollapse: true, isExpand: false });
		expect(setLayoutCollapsed(collapsed, 2, true)).toBe(collapsed);
		expect(setLayoutCollapsed(collapsed, 2, false)[2]).toMatchObject({ isCollapse: false, isExpand: true });
	});

	it('knows when everything is hidden', () => {
		expect(isLayoutAllHidden(base)).toBe(false);
		const all = base.reduce((acc, item) => setLayoutHidden(acc, item.position, true), base);
		expect(isLayoutAllHidden(all)).toBe(true);
	});
});

describe('layout.utils — LayoutHistory (undo memento)', () => {
	it('pops snapshots newest first and reports canUndo', () => {
		const history = new LayoutHistory();
		expect(history.canUndo).toBe(false);
		const a = createDefaultLayout(2);
		const b = setLayoutHidden(a, 0, true);
		history.backup(a);
		history.backup(b);
		expect(history.canUndo).toBe(true);
		expect(history.undo()).toEqual(b);
		expect(history.undo()).toEqual(a);
		expect(history.undo()).toBeUndefined();
	});

	it('snapshots are copies, not references', () => {
		const history = new LayoutHistory();
		const a = createDefaultLayout(1);
		history.backup(a);
		a[0].hide = true;
		expect(history.undo()?.[0].hide).toBe(false);
	});

	it('is bounded', () => {
		const history = new LayoutHistory(2);
		history.backup(createDefaultLayout(1));
		history.backup(createDefaultLayout(2));
		history.backup(createDefaultLayout(3));
		expect(history.size).toBe(2);
		expect(history.undo()?.length).toBe(3);
		expect(history.undo()?.length).toBe(2);
	});
});
