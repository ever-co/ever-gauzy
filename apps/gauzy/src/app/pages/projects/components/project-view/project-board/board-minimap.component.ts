import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	Input,
	OnChanges,
	OnDestroy,
	type SimpleChanges
} from '@angular/core';

/** The part of a sideways scroller on screen, as shares of its whole width. */
export interface IBoardViewport {
	/** How far along it starts, 0–1, from the start of the reading direction. */
	start: number;
	size: number;
}

/** What a scroller shows, or `null` when all of it fits. A right-to-left scroller counts `scrollLeft` below zero. */
export function boardViewportOf(scroller: Pick<HTMLElement, 'scrollLeft' | 'scrollWidth' | 'clientWidth'>): IBoardViewport | null {
	const { scrollLeft, scrollWidth, clientWidth } = scroller;
	// A pixel of rounding is not a scrollbar.
	if (scrollWidth <= clientWidth + 1) return null;
	return { start: Math.abs(scrollLeft) / scrollWidth, size: clientWidth / scrollWidth };
}

/**
 * A map of the board's columns, as Jira's: it floats at the corner of the screen once the columns no longer fit, with
 * a frame round the ones on screen. Dragging the frame scrolls the board, and pressing elsewhere brings that part to
 * the middle. For the pointer only, and hidden from screen readers: the board's own scrollbar stays under the columns.
 */
@Component({
	selector: 'ga-board-minimap',
	standalone: true,
	templateUrl: './board-minimap.component.html',
	styleUrls: ['./board-minimap.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardMinimapComponent implements OnChanges, OnDestroy {
	/** The element whose columns scroll sideways. */
	@Input() target: HTMLElement;
	@Input() columnCount = 0;

	public segments: number[] = [];
	public viewport: IBoardViewport | null = null;
	/** Where the frame was taken, as a share of the map from the frame's start; `null` without a drag. */
	private _grab: number | null = null;
	private _resizeObserver: ResizeObserver | null = null;
	private _watched: HTMLElement | null = null;
	private readonly _measure = () => this.measure();

	constructor(private readonly _changeDetectorRef: ChangeDetectorRef) {}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['target']) this.watch();
		if (changes['columnCount']) {
			this.segments = Array.from({ length: this.columnCount }, (_, index) => index);
			// The new columns are on the page once this pass ends.
			requestAnimationFrame(this._measure);
		}
	}

	ngOnDestroy(): void {
		this.unwatch();
	}

	onPointerDown(event: PointerEvent): void {
		if (!this.viewport) return;
		const { start, size } = this.viewport;
		const within = this.shareAt(event) - start;
		this._grab = within >= 0 && within <= size ? within : size / 2;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		this.scrollTo(event);
	}

	onPointerMove(event: PointerEvent): void {
		if (this._grab !== null) this.scrollTo(event);
	}

	onPointerUp(): void {
		this._grab = null;
	}

	/** The scroller is hidden with its tab, and resized with the window: it reports both by its size. */
	private watch(): void {
		this.unwatch();
		if (!this.target) return;
		this._watched = this.target;
		this._watched.addEventListener('scroll', this._measure, { passive: true });
		this._resizeObserver = new ResizeObserver(this._measure);
		this._resizeObserver.observe(this._watched);
	}

	private unwatch(): void {
		this._watched?.removeEventListener('scroll', this._measure);
		this._resizeObserver?.disconnect();
		this._watched = null;
	}

	private measure(): void {
		if (!this.target) return;
		this.viewport = boardViewportOf(this.target);
		this._changeDetectorRef.markForCheck();
	}

	private get rtl(): boolean {
		return getComputedStyle(this.target).direction === 'rtl';
	}

	/** The share of the map a pointer is at, from the start of the reading direction. */
	private shareAt(event: PointerEvent): number {
		const { left, right, width } = (event.currentTarget as HTMLElement).getBoundingClientRect();
		return (this.rtl ? right - event.clientX : event.clientX - left) / width;
	}

	/** Puts the frame's taken point under the pointer; the browser keeps the scroll within the board. */
	private scrollTo(event: PointerEvent): void {
		const offset = (this.shareAt(event) - this._grab) * this.target.scrollWidth;
		this.target.scrollLeft = this.rtl ? -offset : offset;
	}
}
