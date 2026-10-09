import {
	DashboardLayout,
	IDashboardLayout,
	IDashboardLayoutV2,
	IDashboardTab,
	IDashboardWidgetPlacement,
	JsonData
} from '@gauzy/contracts';

/** Number of columns on a dashboard canvas. */
export const DASHBOARD_GRID_COLUMNS = 12;

/** Default footprint applied when a widget declares no `defaultSize`. */
export const DEFAULT_WIDGET_SIZE = { w: 3, h: 2 };

/** Bytes of entropy in a fallback id — 128 bits, same as a v4 UUID. */
const FALLBACK_ID_BYTES = 16;

/** Monotonic suffix for the no-crypto fallback of {@link createId}. */
let idCounter = 0;

/**
 * Generates a stable identifier for tabs and widget placements.
 *
 * SECURITY NOTE (rule typescript:S2245): these ids are document identity only —
 * a tab key, a placement key, a CDK drop-list handle. They are never a secret,
 * a token, or any part of an access decision: a dashboard is fetched by its own
 * server-issued id and authorized server-side, so nothing follows from knowing
 * or predicting a placement id.
 *
 * They are still produced from Web Crypto wherever it exists — `randomUUID()`
 * first, then `getRandomValues()` — with a plain time-plus-counter fallback for
 * the jsdom/unit-test and insecure-context environments that offer neither.
 */
export function createId(): string {
	const cryptoRef = typeof crypto !== 'undefined' ? crypto : undefined;
	if (typeof cryptoRef?.randomUUID === 'function') {
		return cryptoRef.randomUUID();
	}
	if (typeof cryptoRef?.getRandomValues === 'function') {
		const bytes = cryptoRef.getRandomValues(new Uint8Array(FALLBACK_ID_BYTES));
		return `id-${Array.from(bytes, (byte: number) => byte.toString(16).padStart(2, '0')).join('')}`;
	}
	// Last resort: no Web Crypto at all. Counter-suffixed so two calls in the
	// same millisecond can never collide.
	return `id-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

/**
 * Type guard: is this a v2 (dashboard builder) document?
 *
 * @param layout - Any parsed layout document.
 */
export function isLayoutV2(layout: DashboardLayout | null | undefined): layout is IDashboardLayoutV2 {
	return !!layout && (layout as IDashboardLayoutV2).version === 2 && Array.isArray((layout as IDashboardLayoutV2).tabs);
}

/**
 * Parses a `Dashboard.contentHtml` payload into a layout document.
 *
 * `contentHtml` is a json column on postgres/mysql but `text` on sqlite, so the
 * value may arrive as an object or as a string. Malformed content (including
 * the string `"null"`, arrays, and primitives) yields an empty document rather
 * than throwing — a corrupt row must never break the dashboard.
 *
 * @param content - The raw persisted value.
 */
export function parseLayout(content: JsonData | undefined | null): DashboardLayout {
	if (!content) {
		return {};
	}
	let parsed: unknown = content;
	if (typeof content === 'string') {
		try {
			parsed = JSON.parse(content);
		} catch {
			return {};
		}
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return {};
	}
	return parsed as DashboardLayout;
}

/**
 * Normalizes any persisted layout into a v2 document.
 *
 * - v2 documents are returned with their tabs sorted and every placement
 *   clamped to the grid.
 * - v1 snapshots (and empty documents) become a v2 document with a single
 *   empty tab, while PRESERVING the original v1 payload so the legacy renderer
 *   can keep displaying dashboards created before the builder shipped.
 *
 * @param layout - A parsed layout document.
 * @param defaultTabName - Name given to the tab created for legacy/empty documents.
 */
export function normalizeLayout(layout: DashboardLayout | null | undefined, defaultTabName = 'Overview'): IDashboardLayoutV2 {
	if (isLayoutV2(layout)) {
		const tabs = [...layout.tabs]
			.filter((tab): tab is IDashboardTab => !!tab && typeof tab === 'object')
			.map((tab, index) => ({
				...tab,
				id: tab.id || createId(),
				name: tab.name || `${defaultTabName} ${index + 1}`,
				order: Number.isFinite(tab.order) ? tab.order : index,
				// `packLayout` (not just `clampPlacement`): clamping fixes each
				// placement in isolation, so a hand-edited or corrupt document could
				// still describe two widgets stacked on the same cells. Packing is
				// idempotent, so a well-formed document passes through unchanged.
				widgets: packLayout(
					(Array.isArray(tab.widgets) ? tab.widgets : []).filter(
						(placement) => !!placement && typeof placement === 'object' && !!placement.widgetId
					)
				)
			}))
			.sort((a, b) => a.order - b.order)
			.map((tab, index) => ({ ...tab, order: index }));

		return {
			...layout,
			version: 2,
			tabs: tabs.length ? tabs : [emptyTab(defaultTabName)]
		};
	}

	// Legacy (v1) or empty: keep the original snapshot alongside an empty canvas.
	const legacy = (layout ?? {}) as IDashboardLayout;
	return {
		...legacy,
		version: 2,
		tabs: [emptyTab(defaultTabName)]
	};
}

/** Builds an empty tab. */
export function emptyTab(name = 'Overview'): IDashboardTab {
	return { id: createId(), name, order: 0, widgets: [] };
}

/**
 * The footprint a widget is added at, from the `defaultSize` it registered.
 *
 * Shared so that what the palette PREVIEWS while dragging and what the canvas
 * actually inserts on drop are the same numbers: the drop slot used to be a
 * hard-coded 4x2, so dropping any widget that had registered something else
 * (a chart at 8x5, say) re-arranged the grid the moment the real cell replaced
 * the preview, and the widget did not land where it had been aimed.
 *
 * @param size - The registered `defaultSize`, if the widget declared one.
 * @returns A footprint clamped to the grid, defaulting to {@link DEFAULT_WIDGET_SIZE}.
 */
export function widgetFootprint(size?: { w?: number; h?: number } | null): { w: number; h: number } {
	return {
		w: clamp(Math.round(size?.w ?? 0) || DEFAULT_WIDGET_SIZE.w, 1, DASHBOARD_GRID_COLUMNS),
		h: Math.max(Math.round(size?.h ?? 0) || DEFAULT_WIDGET_SIZE.h, 1)
	};
}

/** Clamps a placement's geometry into the grid and enforces positive spans. */
export function clampPlacement(placement: IDashboardWidgetPlacement): IDashboardWidgetPlacement {
	const w = clamp(Math.round(placement.w) || DEFAULT_WIDGET_SIZE.w, 1, DASHBOARD_GRID_COLUMNS);
	const x = clamp(Math.round(placement.x) || 0, 0, DASHBOARD_GRID_COLUMNS - w);
	return {
		...placement,
		instanceId: placement.instanceId || createId(),
		x,
		w,
		y: Math.max(0, Math.round(placement.y) || 0),
		h: Math.max(1, Math.round(placement.h) || DEFAULT_WIDGET_SIZE.h)
	};
}

/** Clamps `value` into the inclusive range [min, max]. */
function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** Do two placements overlap on the grid? */
function collides(a: IDashboardWidgetPlacement, b: IDashboardWidgetPlacement): boolean {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Resolves overlaps and compacts placements upwards.
 *
 * Placements are processed in reading order (top-to-bottom, then left-to-right)
 * and each is pulled up to the first row where it collides with nothing already
 * placed. The result is deterministic, gap-free vertically, and stable for
 * inputs that are already packed.
 *
 * @param placements - The placements of a single tab.
 * @returns A new array of placements with corrected `y` values.
 */
export function packLayout(placements: IDashboardWidgetPlacement[]): IDashboardWidgetPlacement[] {
	const ordered = [...(placements ?? [])]
		.map(clampPlacement)
		.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

	const packed: IDashboardWidgetPlacement[] = [];
	for (const placement of ordered) {
		const candidate = { ...placement, y: 0 };
		// Jump straight past the lowest edge the candidate currently overlaps,
		// rather than stepping one row at a time: a persisted (or corrupt) `h` of
		// a few thousand rows would otherwise make this loop run for that many
		// iterations per widget and freeze the canvas.
		let blockers = packed.filter((other) => collides(candidate, other));
		while (blockers.length) {
			candidate.y = Math.max(...blockers.map((other) => other.y + other.h));
			blockers = packed.filter((other) => collides(candidate, other));
		}
		packed.push(candidate);
	}
	return packed;
}

/**
 * Sorts placements into reading order: top-to-bottom, then left-to-right.
 *
 * This is the order the canvas renders in, and therefore the order the CDK drag
 * indices of a drop event refer to.
 *
 * @param placements - The placements of a single tab.
 * @returns A new array, sorted.
 */
export function readingOrder(placements: IDashboardWidgetPlacement[]): IDashboardWidgetPlacement[] {
	return [...(placements ?? [])].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
}

/**
 * Assigns grid coordinates to placements, in the order they are GIVEN.
 *
 * Unlike {@link packLayout} — which only ever corrects `y`, leaving `x` exactly
 * where it was — this assigns both coordinates. That is what makes a canvas
 * re-arrangeable at all: the builder offers no way to place a widget at an
 * arbitrary column (widgets are appended, reordered by drag, and resized from a
 * menu), so the arrangement IS the order of this array. A reorder that could not
 * move a widget horizontally was a silent no-op for every pair of widgets
 * sharing a row, because the reading-order sort read the untouched `x` values
 * back and restored the original order.
 *
 * ── Why this mirrors CSS grid auto-placement ─────────────────────────────────
 *
 * The canvas renders its cells with spans only (`grid-column: span w`) and lets
 * the browser place them, because CDK shows a drag by MOVING THE PLACEHOLDER
 * NODE between cells — pinning each cell to an absolute column would make DOM
 * order, and therefore the whole drag, invisible.
 *
 * So the browser owns where a widget actually appears, and this function has to
 * agree with it or the persisted `x`/`y` would describe a layout nobody sees.
 * It is therefore the "sparse" packing algorithm from CSS Grid §8.5 step 4: a
 * cursor that only ever moves forwards, and each item taking the first column at
 * or after it where its footprint does not overlap something already placed.
 * Sparse, not dense: dense back-fills earlier gaps, which would let a widget
 * render before one that precedes it in the array — and the index CDK reports
 * for a drop is a position in that array.
 *
 * The result is stable — reading order and array order agree afterwards — so the
 * indices of the next drag line up with what the user sees. It also closes the
 * column gap a removed or narrowed widget leaves behind, which vertical-only
 * packing cannot do.
 *
 * @param placements - The placements of a single tab, in the intended order.
 * @returns A new array with `x`/`y` assigned, free of overlaps and column gaps.
 */
export function flowLayout(placements: IDashboardWidgetPlacement[]): IDashboardWidgetPlacement[] {
	const flowed: IDashboardWidgetPlacement[] = [];
	// The auto-placement cursor. Its row never decreases, which is what keeps
	// reading order and array order identical.
	let cursorRow = 0;
	let cursorColumn = 0;

	for (const candidate of placements ?? []) {
		const placement = clampPlacement(candidate);
		let row = cursorRow;
		let column = cursorColumn;

		// `clampPlacement` caps `w` at the column count, so a widget always fits on
		// an empty row: the scan can never run past the bottom of the content.
		for (;;) {
			if (column + placement.w > DASHBOARD_GRID_COLUMNS) {
				row++;
				column = 0;
			} else if (flowed.some((other) => collides({ ...placement, x: column, y: row }, other))) {
				column++;
			} else {
				break;
			}
		}

		flowed.push({ ...placement, x: column, y: row });
		cursorRow = row;
		cursorColumn = column + placement.w;
	}
	return flowed;
}

/** A canvas cell's box on screen, in viewport coordinates. */
export interface ICanvasCellRect {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

/**
 * Is a point inside a cell's box?
 *
 * @param rect - The cell's box.
 * @param point - A viewport-space point.
 */
export function isPointInRect(rect: ICanvasCellRect, point: { x: number; y: number }): boolean {
	return point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom;
}

/**
 * Reading-order position a point belongs at, for a drop that landed in the
 * canvas' empty space rather than on a cell.
 *
 * CDK only re-sorts while the pointer is over ANOTHER cell — its mixed strategy
 * resolves the target with `elementFromPoint` — so releasing over a gap, over
 * the ragged space beside a tall widget, or over the run-off below the last row
 * silently keeps whatever index the last cell the pointer crossed produced. A
 * user dragging a widget down to the bottom of the canvas therefore watched it
 * land back near where it started, which reads as "drag and drop is broken".
 *
 * A cell counts as preceding the point when it ends above it, or when it shares
 * the point's row band and its horizontal midpoint is to the left — i.e. exactly
 * the reading order the canvas lays out in. The count is the insert position.
 *
 * @param rects - The cells' boxes, in reading order.
 * @param point - Where the pointer was released, in viewport coordinates.
 * @returns An index in `[0, rects.length]`.
 */
export function dropIndexAtPoint(rects: readonly ICanvasCellRect[], point: { x: number; y: number }): number {
	let index = 0;
	for (const rect of rects) {
		const endsAbove = rect.bottom <= point.y;
		const sharesRow = point.y >= rect.top && point.y < rect.bottom;
		if (endsAbove || (sharesRow && (rect.left + rect.right) / 2 <= point.x)) {
			index++;
		}
	}
	return index;
}

/**
 * Inserts a new placement into a tab at the requested grid position, then
 * repacks so nothing overlaps.
 *
 * @param placements - Existing placements.
 * @param placement - The placement being added.
 */
export function addPlacement(
	placements: IDashboardWidgetPlacement[],
	placement: IDashboardWidgetPlacement
): IDashboardWidgetPlacement[] {
	return packLayout([...(placements ?? []), clampPlacement(placement)]);
}

/**
 * Moves a placement to a new index in reading order, then re-flows the tab so
 * the new order is what the grid actually shows.
 *
 * @param placements - Existing placements.
 * @param fromIndex - The index the placement was dragged from.
 * @param toIndex - The index it was dropped at.
 */
export function movePlacement(
	placements: IDashboardWidgetPlacement[],
	fromIndex: number,
	toIndex: number
): IDashboardWidgetPlacement[] {
	const ordered = readingOrder(placements);
	if (fromIndex < 0 || fromIndex >= ordered.length) {
		return flowLayout(ordered);
	}
	const [moved] = ordered.splice(fromIndex, 1);
	// `clamp(NaN, ...)` is NaN and `splice(NaN, ...)` silently inserts at 0, so an
	// unresolved drop index would jump the widget to the front instead of leaving
	// it where it was. Anything non-finite therefore lands at the end.
	const target = Number.isFinite(toIndex) ? clamp(Math.round(toIndex), 0, ordered.length) : ordered.length;
	ordered.splice(target, 0, moved);
	// Re-FLOW, not repack: packing only corrects `y`, so a move between two
	// widgets on the same row left both `x` values untouched and the next
	// reading-order sort put them straight back. See {@link flowLayout}.
	return flowLayout(ordered);
}

/** Removes a placement by instance id. */
export function removePlacement(
	placements: IDashboardWidgetPlacement[],
	instanceId: string
): IDashboardWidgetPlacement[] {
	return packLayout((placements ?? []).filter((placement) => placement.instanceId !== instanceId));
}

/** Resizes a placement, clamping to the grid, then repacks. */
export function resizePlacement(
	placements: IDashboardWidgetPlacement[],
	instanceId: string,
	size: { w?: number; h?: number }
): IDashboardWidgetPlacement[] {
	return packLayout(
		(placements ?? []).map((placement) =>
			placement.instanceId === instanceId
				? clampPlacement({ ...placement, w: size.w ?? placement.w, h: size.h ?? placement.h })
				: placement
		)
	);
}
