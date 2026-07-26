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

/**
 * Generates a stable identifier for tabs and widget placements.
 *
 * Uses `crypto.randomUUID()` when available (all supported browsers) and falls
 * back to a random string so unit tests and non-secure contexts still work.
 */
export function createId(): string {
	const cryptoRef = typeof crypto !== 'undefined' ? crypto : undefined;
	if (cryptoRef?.randomUUID) {
		return cryptoRef.randomUUID();
	}
	return `id-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
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
				widgets: (Array.isArray(tab.widgets) ? tab.widgets : [])
					.filter((placement) => !!placement && typeof placement === 'object' && !!placement.widgetId)
					.map(clampPlacement)
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
		// Walk down until the candidate no longer collides with a placed widget.
		while (packed.some((other) => collides(candidate, other))) {
			candidate.y += 1;
		}
		packed.push(candidate);
	}
	return packed;
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
 * Moves the placement identified by `instanceId` to a new index in reading
 * order (used by the PR-1 ordered-list drag), then repacks.
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
	const ordered = [...(placements ?? [])].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
	if (fromIndex < 0 || fromIndex >= ordered.length) {
		return packLayout(ordered);
	}
	const [moved] = ordered.splice(fromIndex, 1);
	ordered.splice(clamp(toIndex, 0, ordered.length), 0, moved);
	// Re-assign rows in the new reading order before packing so the drop sticks.
	return packLayout(ordered.map((placement, index) => ({ ...placement, y: index })));
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
