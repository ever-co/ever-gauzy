import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { fromEvent, Subject } from 'rxjs';
import { debounceTime, filter, takeUntil, throttleTime } from 'rxjs/operators';

/**
 * Infinite Scroll Directive
 *
 * Reusable directive that implements infinite scroll functionality following SOLID principles:
 * - Single Responsibility: Only handles scroll detection and event emission
 * - Open/Closed: Extensible through inputs, closed for modification
 * - Liskov Substitution: Can be used on any scrollable element
 * - Interface Segregation: Minimal, focused interface
 * - Dependency Inversion: Depends on abstractions (EventEmitter) not concrete implementations
 *
 * @example
 * <div
 *   libInfiniteScroll
 *   [scrollThreshold]="200"
 *   [debounceTime]="300"
 *   [disabled]="!hasMore"
 *   (scrolled)="loadMore()">
 *   <!-- content -->
 * </div>
 */
@Directive({
	selector: '[libInfiniteScroll]',
	standalone: true
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
	/**
	 * Distance in pixels from bottom to trigger load more
	 * Default: 200px
	 */
	@Input() scrollThreshold = 200;

	/**
	 * Debounce time in milliseconds
	 * Prevents too many rapid scroll events
	 * Default: 300ms
	 */
	@Input() debounceTime = 300;

	/**
	 * Whether infinite scroll is disabled
	 * Useful when no more data available or loading
	 */
	@Input() disabled = false;

	/**
	 * Emits when user scrolls near bottom
	 * Consumer should load more data when this fires
	 */
	@Output() scrolled = new EventEmitter<void>();

	/**
	 * Subject for cleanup
	 */
	private readonly destroy$ = new Subject<void>();

	constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

	ngOnInit(): void {
		this.setupScrollListener();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	/**
	 * Setup scroll event listener with proper RxJS operators
	 * Implements efficient scroll handling:
	 * - Throttle to limit frequency
	 * - Debounce to wait for scroll to settle
	 * - Filter to check threshold and disabled state
	 */
	private setupScrollListener(): void {
		const element = this.elementRef.nativeElement;

		fromEvent(element, 'scroll')
			.pipe(
				throttleTime(100), // Throttle to max 10 events per second
				debounceTime(this.debounceTime), // Wait for scroll to settle
				filter(() => !this.disabled), // Don't trigger if disabled
				filter(() => this.isNearBottom()), // Only trigger near bottom
				takeUntil(this.destroy$)
			)
			.subscribe(() => {
				this.scrolled.emit();
			});
	}

	/**
	 * Check if scroll position is near bottom
	 * @returns True if within threshold distance from bottom
	 */
	private isNearBottom(): boolean {
		const element = this.elementRef.nativeElement;
		const scrollPosition = element.scrollTop + element.clientHeight;
		const scrollHeight = element.scrollHeight;
		const threshold = this.scrollThreshold;

		return scrollHeight - scrollPosition <= threshold;
	}
}
