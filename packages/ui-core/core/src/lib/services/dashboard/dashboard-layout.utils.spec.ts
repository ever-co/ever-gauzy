import { IDashboardWidgetPlacement } from '@gauzy/contracts';
import {
	addPlacement,
	clampPlacement,
	DASHBOARD_GRID_COLUMNS,
	dropIndexAtPoint,
	flowLayout,
	isPointInRect,
	isLayoutV2,
	movePlacement,
	normalizeLayout,
	packLayout,
	parseLayout,
	removePlacement,
	resizePlacement
} from './dashboard-layout.utils';

/** Builds a placement with sensible defaults for tests. */
function place(partial: Partial<IDashboardWidgetPlacement> & { instanceId: string }): IDashboardWidgetPlacement {
	return { widgetId: 'w', x: 0, y: 0, w: 3, h: 2, ...partial };
}

/** Do two placements overlap? (independent re-implementation for assertions) */
function overlaps(a: IDashboardWidgetPlacement, b: IDashboardWidgetPlacement): boolean {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function assertNoOverlap(placements: IDashboardWidgetPlacement[]): void {
	for (let i = 0; i < placements.length; i++) {
		for (let j = i + 1; j < placements.length; j++) {
			expect(overlaps(placements[i], placements[j])).toBe(false);
		}
	}
}

describe('parseLayout', () => {
	it('returns an empty document for nullish content', () => {
		expect(parseLayout(null)).toEqual({});
		expect(parseLayout(undefined)).toEqual({});
		expect(parseLayout('')).toEqual({});
	});

	it('parses a JSON string (sqlite text column)', () => {
		expect(parseLayout('{"widgets":[]}')).toEqual({ widgets: [] });
	});

	it('does not throw on malformed roots', () => {
		expect(parseLayout('null')).toEqual({});
		expect(parseLayout('[1,2,3]')).toEqual({});
		expect(parseLayout('"a string"')).toEqual({});
		expect(parseLayout('{ not json')).toEqual({});
	});
});

describe('normalizeLayout', () => {
	it('creates a single empty tab for an empty document', () => {
		const layout = normalizeLayout({});
		expect(layout.version).toBe(2);
		expect(layout.tabs).toHaveLength(1);
		expect(layout.tabs[0].widgets).toEqual([]);
	});

	it('preserves a legacy v1 snapshot alongside the new empty tab', () => {
		const v1 = { widgets: [{ position: 2, title: 'Members' }], windows: [] };
		const layout = normalizeLayout(v1);
		expect(layout.widgets).toEqual(v1.widgets);
		expect(layout.tabs).toHaveLength(1);
	});

	it('sorts tabs by order and re-indexes them', () => {
		const layout = normalizeLayout({
			version: 2,
			tabs: [
				{ id: 'b', name: 'B', order: 5, widgets: [] },
				{ id: 'a', name: 'A', order: 1, widgets: [] }
			]
		} as never);
		expect(layout.tabs.map((t) => t.id)).toEqual(['a', 'b']);
		expect(layout.tabs.map((t) => t.order)).toEqual([0, 1]);
	});

	it('drops placements without a widgetId and keeps valid ones', () => {
		const layout = normalizeLayout({
			version: 2,
			tabs: [{ id: 't', name: 'T', order: 0, widgets: [{ instanceId: '1' }, place({ instanceId: '2' })] }]
		} as never);
		expect(layout.tabs[0].widgets).toHaveLength(1);
		expect(layout.tabs[0].widgets[0].instanceId).toBe('2');
	});

	it('replaces an empty tabs array with one empty tab', () => {
		const layout = normalizeLayout({ version: 2, tabs: [] } as never);
		expect(layout.tabs).toHaveLength(1);
	});
});

describe('isLayoutV2', () => {
	it('distinguishes v2 documents from v1 snapshots', () => {
		expect(isLayoutV2({ version: 2, tabs: [] } as never)).toBe(true);
		expect(isLayoutV2({ widgets: [] })).toBe(false);
		expect(isLayoutV2(null)).toBe(false);
		expect(isLayoutV2({ version: 2 } as never)).toBe(false);
	});
});

describe('clampPlacement', () => {
	it('keeps widgets inside the 12 column grid', () => {
		const clamped = clampPlacement(place({ instanceId: '1', x: 11, w: 6 }));
		expect(clamped.x + clamped.w).toBeLessThanOrEqual(DASHBOARD_GRID_COLUMNS);
	});

	it('enforces positive spans and non-negative rows', () => {
		const clamped = clampPlacement(place({ instanceId: '1', x: -4, y: -2, w: 0, h: 0 }));
		expect(clamped.x).toBe(0);
		expect(clamped.y).toBe(0);
		expect(clamped.w).toBeGreaterThan(0);
		expect(clamped.h).toBeGreaterThan(0);
	});

	it('assigns a missing instanceId', () => {
		expect(clampPlacement({ widgetId: 'w', x: 0, y: 0, w: 3, h: 2 } as never).instanceId).toBeTruthy();
	});
});

describe('packLayout', () => {
	it('compacts widgets upwards, removing vertical gaps', () => {
		const packed = packLayout([place({ instanceId: '1', y: 7 })]);
		expect(packed[0].y).toBe(0);
	});

	it('resolves overlaps', () => {
		const packed = packLayout([
			place({ instanceId: '1', x: 0, y: 0, w: 6, h: 2 }),
			place({ instanceId: '2', x: 0, y: 0, w: 6, h: 2 })
		]);
		assertNoOverlap(packed);
	});

	it('keeps side-by-side widgets on the same row', () => {
		const packed = packLayout([
			place({ instanceId: '1', x: 0, y: 0, w: 6, h: 2 }),
			place({ instanceId: '2', x: 6, y: 0, w: 6, h: 2 })
		]);
		expect(packed.every((p) => p.y === 0)).toBe(true);
	});

	it('is idempotent', () => {
		const once = packLayout([
			place({ instanceId: '1', x: 0, y: 3, w: 4, h: 2 }),
			place({ instanceId: '2', x: 4, y: 9, w: 4, h: 2 }),
			place({ instanceId: '3', x: 0, y: 1, w: 12, h: 1 })
		]);
		expect(packLayout(once)).toEqual(once);
	});

	it('handles an empty or nullish list', () => {
		expect(packLayout([])).toEqual([]);
		expect(packLayout(undefined as never)).toEqual([]);
	});

	it('never produces overlaps for a dense random-ish set', () => {
		const placements = Array.from({ length: 20 }, (_, i) =>
			place({ instanceId: String(i), x: (i * 5) % 10, y: (i * 3) % 7, w: ((i % 3) + 1) * 2, h: (i % 2) + 1 })
		);
		assertNoOverlap(packLayout(placements));
	});
});

describe('flowLayout', () => {
	it('wraps across the 12 columns in the order it is given', () => {
		const flowed = flowLayout([
			place({ instanceId: 'a', w: 6, h: 2 }),
			place({ instanceId: 'b', w: 6, h: 2 }),
			place({ instanceId: 'c', w: 6, h: 2 })
		]);
		expect(flowed.map((p) => [p.x, p.y])).toEqual([
			[0, 0],
			[6, 0],
			[0, 2]
		]);
	});

	it('assigns x, so reordering two widgets on the same row actually moves them', () => {
		const flowed = flowLayout([place({ instanceId: 'b', x: 6, w: 6 }), place({ instanceId: 'a', x: 0, w: 6 })]);
		expect(flowed.find((p) => p.instanceId === 'b')?.x).toBe(0);
		expect(flowed.find((p) => p.instanceId === 'a')?.x).toBe(6);
	});

	it('leaves reading order equal to array order, so it is stable', () => {
		const flowed = flowLayout([
			place({ instanceId: 'a', w: 4, h: 3 }),
			place({ instanceId: 'b', w: 4, h: 1 }),
			place({ instanceId: 'c', w: 4, h: 2 }),
			place({ instanceId: 'd', w: 8, h: 2 })
		]);
		expect(flowLayout(flowed)).toEqual(flowed);
		expect([...flowed].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y))).toEqual(flowed);
	});

	it('packs like CSS grid auto-placement, which is what actually renders', () => {
		// Verified against a real browser: the canvas renders cells with spans only
		// (so CDK's drag can reorder them), which makes the GRID the authority on
		// where a widget sits. `d` tucks in beside the tall `a` at column 4 rather
		// than starting a fresh row — if this drifts, the persisted x/y stops
		// describing the layout the user is looking at.
		const flowed = flowLayout([
			place({ instanceId: 'a', w: 4, h: 3 }),
			place({ instanceId: 'b', w: 4, h: 1 }),
			place({ instanceId: 'c', w: 4, h: 2 }),
			place({ instanceId: 'd', w: 8, h: 2 }),
			place({ instanceId: 'e', w: 4, h: 2 })
		]);
		expect(flowed.map((p) => [p.x, p.y])).toEqual([
			[0, 0],
			[4, 0],
			[8, 0],
			[4, 2],
			[0, 3]
		]);
		assertNoOverlap(flowed);
	});

	it('closes the column gap a removed widget leaves behind', () => {
		const flowed = flowLayout([place({ instanceId: 'a', x: 0, w: 3 }), place({ instanceId: 'c', x: 6, w: 3 })]);
		expect(flowed.map((p) => p.x)).toEqual([0, 3]);
	});

	it('never overlaps and never overflows the grid', () => {
		const flowed = flowLayout(
			Array.from({ length: 20 }, (_, i) =>
				place({ instanceId: String(i), x: (i * 5) % 10, y: (i * 3) % 7, w: ((i % 4) + 1) * 3, h: (i % 3) + 1 })
			)
		);
		assertNoOverlap(flowed);
		expect(flowed.every((p) => p.x + p.w <= DASHBOARD_GRID_COLUMNS)).toBe(true);
	});

	it('handles an empty or nullish list', () => {
		expect(flowLayout([])).toEqual([]);
		expect(flowLayout(undefined as never)).toEqual([]);
	});
});

describe('drop point geometry', () => {
	/** Two rows of three 100x50 cells, laid out like the canvas does. */
	const grid = [
		{ left: 0, right: 100, top: 0, bottom: 50 },
		{ left: 110, right: 210, top: 0, bottom: 50 },
		{ left: 220, right: 320, top: 0, bottom: 50 },
		{ left: 0, right: 100, top: 60, bottom: 110 },
		{ left: 110, right: 210, top: 60, bottom: 110 },
		{ left: 220, right: 320, top: 60, bottom: 110 }
	];

	it('places a point below every cell at the end', () => {
		expect(dropIndexAtPoint(grid, { x: 160, y: 400 })).toBe(6);
	});

	it('places a point in the gutter between two cells between them', () => {
		// x = 105 is the gap between cell 0 and cell 1 on the first row.
		expect(dropIndexAtPoint(grid, { x: 105, y: 25 })).toBe(1);
	});

	it('reads the second row as coming after the whole first row', () => {
		expect(dropIndexAtPoint(grid, { x: 105, y: 85 })).toBe(4);
	});

	it('places a point left of everything at the front', () => {
		expect(dropIndexAtPoint(grid, { x: -20, y: 25 })).toBe(0);
	});

	it('places a point right of a row at the end of that row', () => {
		expect(dropIndexAtPoint(grid, { x: 500, y: 25 })).toBe(3);
	});

	it('answers 0 for an empty canvas', () => {
		expect(dropIndexAtPoint([], { x: 10, y: 10 })).toBe(0);
	});

	it('detects whether a point is inside a cell', () => {
		expect(isPointInRect(grid[0], { x: 50, y: 25 })).toBe(true);
		expect(isPointInRect(grid[0], { x: 105, y: 25 })).toBe(false);
		// Half-open, so neighbouring cells can never both claim an edge.
		expect(isPointInRect(grid[0], { x: 0, y: 0 })).toBe(true);
		expect(isPointInRect(grid[0], { x: 100, y: 25 })).toBe(false);
	});
});

describe('placement mutations', () => {
	it('adds a placement without overlapping existing ones', () => {
		const existing = [place({ instanceId: '1', x: 0, y: 0, w: 12, h: 2 })];
		const next = addPlacement(existing, place({ instanceId: '2', x: 0, y: 0, w: 12, h: 2 }));
		expect(next).toHaveLength(2);
		assertNoOverlap(next);
	});

	it('removes a placement by instance id and repacks', () => {
		const next = removePlacement(
			[place({ instanceId: '1', y: 0, w: 12 }), place({ instanceId: '2', y: 2, w: 12 })],
			'1'
		);
		expect(next).toHaveLength(1);
		expect(next[0].instanceId).toBe('2');
		expect(next[0].y).toBe(0);
	});

	it('resizes a placement and clamps it to the grid', () => {
		const next = resizePlacement([place({ instanceId: '1', x: 8, w: 4 })], '1', { w: 12 });
		expect(next[0].x + next[0].w).toBeLessThanOrEqual(DASHBOARD_GRID_COLUMNS);
	});

	it('reorders placements by reading order', () => {
		const placements = [
			place({ instanceId: 'a', y: 0, w: 12 }),
			place({ instanceId: 'b', y: 2, w: 12 }),
			place({ instanceId: 'c', y: 4, w: 12 })
		];
		const moved = movePlacement(placements, 0, 2);
		const order = [...moved].sort((x, y) => x.y - y.y).map((p) => p.instanceId);
		expect(order).toEqual(['b', 'c', 'a']);
	});

	it('moves a widget between two others sharing its row', () => {
		// The row is [a][b][c]; dragging `a` onto `c`'s slot must actually change
		// what the grid shows. Repacking alone could not: it only corrects `y`.
		const row = flowLayout([
			place({ instanceId: 'a', w: 4 }),
			place({ instanceId: 'b', w: 4 }),
			place({ instanceId: 'c', w: 4 })
		]);
		const moved = movePlacement(row, 0, 2);
		expect(moved.map((p) => p.instanceId)).toEqual(['b', 'c', 'a']);
		expect(moved.map((p) => p.x)).toEqual([0, 4, 8]);
		expect(moved.every((p) => p.y === 0)).toBe(true);
	});

	it('ignores an out-of-range move index', () => {
		const placements = [place({ instanceId: 'a', w: 12 })];
		expect(movePlacement(placements, 5, 0)).toHaveLength(1);
	});
});
