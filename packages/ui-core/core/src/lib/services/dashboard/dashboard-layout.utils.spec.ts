import { IDashboardWidgetPlacement } from '@gauzy/contracts';
import {
	addPlacement,
	clampPlacement,
	DASHBOARD_GRID_COLUMNS,
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

	it('ignores an out-of-range move index', () => {
		const placements = [place({ instanceId: 'a', w: 12 })];
		expect(movePlacement(placements, 5, 0)).toHaveLength(1);
	});
});
