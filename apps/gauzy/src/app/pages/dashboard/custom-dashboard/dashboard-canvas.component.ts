import { Component, ElementRef, EventEmitter, Input, Output } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { TranslateService } from '@ngx-translate/core';
import { IDashboardTab, IDashboardWidgetPlacement } from '@gauzy/contracts';
import {
	createId,
	DASHBOARD_GRID_COLUMNS,
	DEFAULT_WIDGET_SIZE,
	dropIndexAtPoint,
	flowLayout,
	ICanvasCellRect,
	isPointInRect,
	movePlacement,
	readingOrder,
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
 * The arrangement IS the order of `placements`: every mutation below edits that
 * list and hands it to `flowLayout`, which assigns the grid coordinates by
 * wrapping the widgets across the 12 columns. Nothing here computes an `x` or a
 * `y` itself — that is what keeps a drop, a removal and a resize from each
 * needing their own (and subtly different) idea of where a widget belongs.
 */
@Component({
	selector: 'ga-dashboard-canvas',
	templateUrl: './dashboard-canvas.component.html',
	styleUrls: ['./dashboard-canvas.component.scss'],
	standalone: false
})
export class DashboardCanvasComponent extends TranslationBaseComponent {
	/**
	 * Placements of the active tab.
	 *
	 * Array order IS reading order (top-to-bottom, then left-to-right) — the
	 * flow guarantees it — which is what makes the array index of a placement
	 * and the index CDK reports for a drop the same number.
	 */
	public placements: IDashboardWidgetPlacement[] = [];

	private _tab: IDashboardTab | null = null;

	/** The tab being rendered. */
	@Input()
	public set tab(value: IDashboardTab | null) {
		this._tab = value ?? null;
		// Flowed on the way in as well: a document saved before the canvas flowed
		// its layout can hold column gaps, and reading them back unchanged would
		// mean the first drag re-arranged more than the widget being dragged.
		// Sorting first preserves what the user last saw.
		this.placements = flowLayout(readingOrder(value?.widgets ?? []));
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
		private readonly _widgetRegistry: WidgetRegistryService,
		private readonly _elementRef: ElementRef<HTMLElement>
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

		// Released off the canvas: nothing changes. CDK leaves a rejected or stray
		// item at whatever index the last cell the pointer crossed produced, so
		// without this, flicking a widget towards the palette (which refuses it)
		// quietly reordered the canvas on the way past.
		//
		// Measured here rather than read from `event.isPointerOverContainer`:
		// CDK answers that from a rect it cached when the drag STARTED, and a
		// layout shift during the drag — the palette losing the row being dragged
		// out of it, say — leaves that rect tens of pixels stale, which rejects
		// drops the user made well inside the canvas. `DropListRef.drop()` puts
		// the pre-drag DOM back before it emits, so measuring now reads the same
		// frame the drag indices are expressed in.
		const canvas = this._canvasElement();
		if (event.dropPoint && canvas && !isPointInRect(canvas.getBoundingClientRect(), event.dropPoint)) {
			return;
		}

		const index = this._resolveDropIndex(event);

		if (event.previousContainer === event.container) {
			if (index === event.previousIndex) {
				return;
			}
			// `movePlacement` performs the move AND re-flows, so the array must not
			// be mutated with `moveItemInArray` first (that would move it twice).
			this._emit(movePlacement(this.placements, event.previousIndex, index));
			return;
		}

		const widgetId = (event.item?.data as { widgetId?: string } | undefined)?.widgetId;
		if (widgetId) {
			this.addWidget(widgetId, index);
		}
	}

	/**
	 * Where a drop should actually land.
	 *
	 * Normally that is whatever CDK sorted to, because the placeholder the user
	 * watched is the promise being kept. But CDK's mixed strategy only re-sorts
	 * while the pointer is over another CELL, so releasing over the canvas' empty
	 * space — the gaps, the ragged area beside a tall widget, or the run-off
	 * below the last row — leaves the index of the last cell the pointer happened
	 * to cross. Dragging a widget down to the bottom of the canvas therefore put
	 * it back near where it started.
	 *
	 * In that case, and only then, the position is resolved from where the
	 * pointer actually was. Only ever called for a drop that landed ON the
	 * canvas, so the point is always somewhere a position can be computed for.
	 *
	 * @param event - The CDK drop event.
	 */
	private _resolveDropIndex(event: CdkDragDrop<IDashboardWidgetPlacement[]>): number {
		const point = event.dropPoint;
		if (!point) {
			return event.currentIndex;
		}
		const rects = this._cellRects();
		if (!rects.length || rects.some((rect) => isPointInRect(rect, point))) {
			return event.currentIndex;
		}
		return dropIndexAtPoint(rects, point);
	}

	/**
	 * The cells' boxes, in reading order.
	 *
	 * Safe to read here: `DropListRef.drop()` restores the original DOM order
	 * BEFORE it emits, so the children still line up with `placements` and the
	 * boxes describe the arrangement the drag indices refer to.
	 */
	private _cellRects(): ICanvasCellRect[] {
		const cells = this._elementRef.nativeElement.querySelectorAll<HTMLElement>(
			'.dashboard-canvas > .canvas-cell'
		);
		return Array.from(cells, (cell: HTMLElement) => cell.getBoundingClientRect());
	}

	/** The drop list element itself. */
	private _canvasElement(): HTMLElement | null {
		return this._elementRef.nativeElement.querySelector<HTMLElement>('.dashboard-canvas');
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

		// `x`/`y` are placeholders: `_emit` flows the list, so the only thing that
		// decides where the widget lands is its POSITION IN THE LIST — which is
		// exactly what the drop index describes.
		const placement: IDashboardWidgetPlacement = { instanceId: createId(), widgetId, x: 0, y: 0, w, h };

		const next = [...this.placements];
		next.splice(this._insertIndex(index, next.length), 0, placement);
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
		this._emit(this.placements.filter((item) => item.instanceId !== placement.instanceId));
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
		// Mapped in place rather than through `resizePlacement`: that helper sorts
		// by reading order, which a widget that just grew or shrank no longer
		// satisfies, so a resize could quietly reorder the row around it.
		this._emit(
			this.placements.map((item) =>
				item.instanceId === placement.instanceId
					? { ...item, w: size.w ?? item.w, h: size.h ?? item.h }
					: item
			)
		);
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
	| Drag preview
	|--------------------------------------------------------------------------
	| CDK's default preview is a full clone of the dragged cell. For a widget
	| that is a chart or a table, that is a large, half-transparent card sliding
	| under the cursor with its live content frozen (a cloned <canvas> renders
	| blank), which hides the very slot the user is aiming at. The template shows
	| a small chip instead, built from these two.
	*/

	/**
	 * Label for the drag chip of a placement.
	 *
	 * Falls back to the widget id: registry titles may be a `ResolveFn`, and
	 * running one needs an injection context the template does not have — a chip
	 * is not worth resolving asynchronously for.
	 *
	 * @param placement - The placement being dragged.
	 * @returns A literal, or a translation key for the template's `translate` pipe.
	 */
	public titleFor(placement: IDashboardWidgetPlacement): string {
		if (placement.title) {
			return placement.title;
		}
		const title = this._widgetRegistry.getWidget(placement.widgetId)?.title;
		return typeof title === 'string' ? title : placement.widgetId;
	}

	/**
	 * Icon for the drag chip of a placement.
	 *
	 * @param placement - The placement being dragged.
	 */
	public iconFor(placement: IDashboardWidgetPlacement): string {
		return this._widgetRegistry.getWidget(placement.widgetId)?.icon || 'cube-outline';
	}

	/*
	|--------------------------------------------------------------------------
	| Internals
	|--------------------------------------------------------------------------
	*/

	/**
	 * Publishes a new arrangement.
	 *
	 * The single place geometry is assigned: callers above only ever decide the
	 * ORDER of the list, `flowLayout` turns that order into grid coordinates, and
	 * the page is told what to stage.
	 *
	 * @param placements - The new arrangement, in the intended reading order.
	 */
	private _emit(placements: IDashboardWidgetPlacement[]): void {
		this.placements = flowLayout(placements);
		this.layoutChange.emit(this.placements);
	}

	/**
	 * Resolves a CDK drop index into a safe splice position.
	 *
	 * CDK reports `-1` when it could not work out where the pointer was, and
	 * `splice(NaN, ...)` silently inserts at the FRONT — either would drop the
	 * widget somewhere the user did not aim for, so anything unusable appends.
	 *
	 * @param index - The index reported by the drop event, if any.
	 * @param length - Current length of the list being inserted into.
	 */
	private _insertIndex(index: number | undefined, length: number): number {
		if (index === undefined || !Number.isFinite(index) || index < 0) {
			return length;
		}
		return Math.min(Math.round(index), length);
	}
}
