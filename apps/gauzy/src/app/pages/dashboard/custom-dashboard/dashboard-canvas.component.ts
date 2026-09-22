import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { TranslateService } from '@ngx-translate/core';
import { IDashboardTab, IDashboardWidgetPlacement } from '@gauzy/contracts';
import {
	addPlacement,
	createId,
	DASHBOARD_GRID_COLUMNS,
	DEFAULT_WIDGET_SIZE,
	movePlacement,
	packLayout,
	removePlacement,
	resizePlacement,
	WidgetRegistryService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

/** Default id of the canvas CDK drop list — the palette connects to it by name. */
export const DASHBOARD_CANVAS_DROP_LIST_ID = 'ga-dashboard-canvas-list';

/**
 * The canvas of a single dashboard tab.
 *
 * Renders the tab's widget placements on a 12 column CSS grid, each cell hosting
 * a `<ga-dashboard-widget-host>`. In edit mode the cells can be reordered by
 * drag & drop and new widgets can be dropped in from the widget palette.
 *
 * All geometry (clamping, packing, insert/move/resize) is delegated to the
 * shared, unit-tested helpers in `dashboard-layout.utils` — this component only
 * translates CDK drop events into calls on those helpers and re-emits the
 * resulting placement list.
 */
@Component({
	selector: 'ga-dashboard-canvas',
	templateUrl: './dashboard-canvas.component.html',
	styleUrls: ['./dashboard-canvas.component.scss'],
	standalone: false
})
export class DashboardCanvasComponent extends TranslationBaseComponent {
	/** Placements of the active tab, always kept in reading order (top-to-bottom, then left-to-right). */
	public placements: IDashboardWidgetPlacement[] = [];

	private _tab: IDashboardTab | null = null;

	/** The tab being rendered. */
	@Input()
	public set tab(value: IDashboardTab | null) {
		this._tab = value ?? null;
		this.placements = this._readingOrder(
			(value?.widgets ?? []).map((placement) => this._normalizePlacementHeight(placement))
		);
	}
	public get tab(): IDashboardTab | null {
		return this._tab;
	}

	/** Whether the dashboard is in edit (arrange) mode. */
	@Input() public editing = false;

	/**
	 * CDK drop list id of this canvas. The palette connects to this id, so it is
	 * an input purely to allow more than one canvas on screen later.
	 */
	@Input() public dropListId: string = DASHBOARD_CANVAS_DROP_LIST_ID;

	/** Drop lists this canvas may hand items to. Empty by default (the palette rejects drops). */
	@Input() public connectedTo: string[] = [];

	/** Emits the full placement list of the tab whenever the arrangement changes. */
	@Output() public readonly layoutChange = new EventEmitter<IDashboardWidgetPlacement[]>();

	/**
	 * Re-emits a widget's "configure" request so the page can open the settings dialog.
	 *
	 * Named `configureRequested` for symmetry with the widget host: outputs here
	 * must never collide with a native DOM event name.
	 */
	@Output() public readonly configureRequested = new EventEmitter<IDashboardWidgetPlacement>();

	constructor(
		public readonly translateService: TranslateService,
		private readonly _widgetRegistry: WidgetRegistryService
	) {
		super(translateService);
	}

	/*
	|--------------------------------------------------------------------------
	| Drag & drop
	|--------------------------------------------------------------------------
	*/

	/**
	 * Handles a CDK drop on the canvas.
	 *
	 * A drop coming from the canvas itself is a reorder; a drop coming from any
	 * other list is a palette drop and creates a brand new placement.
	 *
	 * @param event - The CDK drop event.
	 */
	public onDrop(event: CdkDragDrop<IDashboardWidgetPlacement[]>): void {
		if (!this.editing) {
			return;
		}

		if (event.previousContainer === event.container) {
			if (event.previousIndex === event.currentIndex) {
				return;
			}
			// `movePlacement` performs the move AND repacks, so the array must not
			// be mutated with `moveItemInArray` first (that would move it twice).
			this._emit(movePlacement(this.placements, event.previousIndex, event.currentIndex));
			return;
		}

		const widgetId = (event.item?.data as { widgetId?: string } | undefined)?.widgetId;
		if (widgetId) {
			this.addWidget(widgetId, event.currentIndex);
		}
	}

	/**
	 * Adds a new instance of the given widget to this canvas.
	 *
	 * Also the keyboard-accessible path: the palette calls this (through the page)
	 * when a widget entry is clicked, since dragging is pointer-only.
	 *
	 * @param widgetId - Registry key of the widget to add.
	 * @param index - Optional reading-order index to insert at (from a drop).
	 */
	public addWidget(widgetId: string, index?: number): void {
		const config = this._widgetRegistry.getWidget(widgetId);
		const size = config?.defaultSize ?? DEFAULT_WIDGET_SIZE;
		const w = Math.min(Math.max(Math.round(size.w) || DEFAULT_WIDGET_SIZE.w, 1), DASHBOARD_GRID_COLUMNS);
		const h = Math.max(Math.round(size.h) || DEFAULT_WIDGET_SIZE.h, 1);

		// Pick the first free slot so widgets flow across the 12 columns instead
		// of stacking in column 0 (`packLayout` only ever adjusts `y`).
		const { x, y } = this._firstFreeOrigin(w, h);
		const placement: IDashboardWidgetPlacement = { instanceId: createId(), widgetId, x, y, w, h };

		let next = addPlacement(this.placements, placement);
		if (typeof index === 'number' && index >= 0 && index < next.length) {
			const from = next.findIndex((item) => item.instanceId === placement.instanceId);
			if (from >= 0 && from !== index) {
				next = movePlacement(next, from, index);
			}
		}
		this._emit(next);
	}

	/*
	|--------------------------------------------------------------------------
	| Widget host events
	|--------------------------------------------------------------------------
	*/

	/**
	 * Removes a widget instance from the canvas.
	 *
	 * @param placement - The placement to remove.
	 */
	public onRemove(placement: IDashboardWidgetPlacement): void {
		this._emit(removePlacement(this.placements, placement.instanceId));
	}

	/**
	 * Resizes a widget instance.
	 *
	 * @param placement - The placement being resized.
	 * @param size - The requested footprint; missing dimensions are kept as-is.
	 */
	public onResize(placement: IDashboardWidgetPlacement, size: { w?: number; h?: number } | null | undefined): void {
		if (!size || (size.w === undefined && size.h === undefined)) {
			return;
		}
		this._emit(resizePlacement(this.placements, placement.instanceId, size));
	}

	/** Keeps legacy single-row widgets compact when loading an older layout. */
	private _normalizePlacementHeight(placement: IDashboardWidgetPlacement): IDashboardWidgetPlacement {
		const widget = this._widgetRegistry.getWidget(placement.widgetId);
		const minimumHeight = widget?.minSize?.h;
		if (minimumHeight !== 1 || placement.h <= minimumHeight) {
			return placement;
		}
		return { ...placement, h: minimumHeight };
	}

	/**
	 * Re-emits a widget's configuration request.
	 *
	 * `DashboardWidgetHostComponent.configure` is deliberately payload-less — it
	 * does not own the settings dialog — so the canvas only forwards WHICH
	 * placement the user wants to configure; the resulting configuration comes
	 * back through {@link applyConfig}.
	 *
	 * @param placement - The placement being configured.
	 */
	public onConfigure(placement: IDashboardWidgetPlacement): void {
		this.configureRequested.emit(placement);
	}

	/**
	 * Moves a widget one slot forwards/backwards in reading order.
	 *
	 * The keyboard counterpart of dragging the handle: CDK drag & drop is
	 * pointer-only, so without this the canvas cannot be rearranged at all
	 * without a mouse.
	 *
	 * @param placement - The placement to move.
	 * @param delta - `-1` to move it earlier, `+1` to move it later.
	 * @param event - The originating key event, whose default scroll is suppressed.
	 */
	public moveBy(placement: IDashboardWidgetPlacement, delta: number, event?: Event): void {
		event?.preventDefault();
		if (!this.editing) {
			return;
		}
		const from = this.placements.findIndex((item) => item.instanceId === placement.instanceId);
		const to = from + delta;
		if (from < 0 || to < 0 || to >= this.placements.length) {
			return;
		}
		this._emit(movePlacement(this.placements, from, to));
	}

	/**
	 * Writes a new per-instance configuration onto a placement.
	 *
	 * @param instanceId - The placement to configure.
	 * @param config - The settings produced by the configuration dialog.
	 */
	public applyConfig(instanceId: string, config: Record<string, unknown>): void {
		this._emit(
			this.placements.map((item) =>
				item.instanceId === instanceId ? { ...item, config: { ...config } } : item
			)
		);
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * Publishes a new arrangement: keeps the local list in reading order (so CDK
	 * indices line up with the rendered order) and notifies the page.
	 */
	private _emit(placements: IDashboardWidgetPlacement[]): void {
		this.placements = this._readingOrder(packLayout(placements));
		this.layoutChange.emit(this.placements);
	}

	/** Sorts placements top-to-bottom, then left-to-right. */
	private _readingOrder(placements: IDashboardWidgetPlacement[]): IDashboardWidgetPlacement[] {
		return [...placements].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
	}

	/**
	 * First-fit search for a free `w`x`h` slot, scanning row by row.
	 *
	 * Bounded by the current content height, so it always terminates; when no
	 * gap is large enough the widget starts on a fresh row below everything.
	 */
	private _firstFreeOrigin(w: number, h: number): { x: number; y: number } {
		const bottom = this.placements.reduce((max, item) => Math.max(max, item.y + item.h), 0);
		for (let y = 0; y <= bottom; y++) {
			for (let x = 0; x <= DASHBOARD_GRID_COLUMNS - w; x++) {
				const candidate = { x, y, w, h };
				if (!this.placements.some((item) => this._collides(candidate, item))) {
					return { x, y };
				}
			}
		}
		return { x: 0, y: bottom };
	}

	/** Do two grid rectangles overlap? */
	private _collides(
		a: { x: number; y: number; w: number; h: number },
		b: { x: number; y: number; w: number; h: number }
	): boolean {
		return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
	}
}
