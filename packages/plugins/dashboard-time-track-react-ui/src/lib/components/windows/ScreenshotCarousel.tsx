import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';

/** Imperative handle mirroring the two Swiper calls the Angular template makes. */
export interface ScreenshotCarouselHandle {
	slideNext: () => void;
	slidePrev: () => void;
}

export interface ScreenshotCarouselProps {
	/** One slide per child (each `<swiper-slide>`). */
	children: ReactNode;
	/** Slides per view while they fit (the slide width formula in styles.ts). */
	slidesPerView?: number;
	className?: string;
}

/** Sub-pixel slack when counting visible slides, so a rounded width never drops one. */
const FIT_EPSILON = 0.01;

/** Geometry of the scroller, measured from the DOM, plus the page the scroll position is on. */
interface CarouselState {
	perView: number;
	pitch: number;
	pageCount: number;
	page: number;
	/** Farthest scroll distance from the start edge. */
	maxPosition: number;
	rtl: boolean;
}

/**
 * Measures the scroller: how many slides are visible right now (from fractional widths — an
 * integer `offsetWidth` rounds 194.67px up to 195px and loses a slide), the distance from one
 * slide to the next, how many pages there are (one unless the track really overflows), and which
 * page the scroll position is on.
 *
 * Positions are distances from the START edge: in right-to-left layouts `scrollLeft` runs from
 * 0 towards negative values, so it is read as an absolute value and written back negated.
 *
 * @param scroller The scrolling element.
 */
function readState(scroller: HTMLElement): CarouselState {
	const style = getComputedStyle(scroller);
	const rtl = style.direction === 'rtl';
	const slides = scroller.querySelectorAll<HTMLElement>('.gz-rtt-carousel-slide');
	// The gap lives in ONE place — the `--gz-rtt-slide-gap` custom property in styles.ts.
	const gap = parseFloat(style.getPropertyValue('--gz-rtt-slide-gap')) || 8;
	const viewport = scroller.getBoundingClientRect().width;
	const pitch = slides.length > 0 ? slides[0].getBoundingClientRect().width + gap : viewport;
	const perView = Math.max(1, Math.floor((viewport + gap) / Math.max(pitch, 1) + FIT_EPSILON));
	const maxPosition = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
	const overflows = maxPosition > 1;
	const pageCount = overflows ? Math.max(1, Math.ceil(slides.length / perView)) : 1;
	const position = rtl ? Math.abs(scroller.scrollLeft) : scroller.scrollLeft;
	const atEnd = overflows && position >= maxPosition - 1;
	const page = atEnd ? pageCount - 1 : Math.round(position / (pitch * perView));
	return { perView, pitch, pageCount, page: Math.min(Math.max(page, 0), pageCount - 1), maxPosition, rtl };
}

/**
 * A dependency-free stand-in for `<swiper-container slides-per-view="auto" space-between="8"
 * slides-per-group-auto="true" [pagination]="{ clickable: true }">`: a horizontally scrolling,
 * scroll-snapping track (three slides across while they fit, see styles.ts) with clickable page
 * bullets under it. `slideNext()` / `slidePrev()` — what the arrows in the Recent Activities
 * header call — advance by however many slides are visible, and the bullets are hidden when
 * everything fits on one page, like Swiper's `watchOverflow` lock.
 */
export const ScreenshotCarousel = forwardRef<ScreenshotCarouselHandle, ScreenshotCarouselProps>(function ScreenshotCarousel(
	{ children, slidesPerView = 3, className },
	ref
) {
	const scrollerRef = useRef<HTMLDivElement>(null);
	const [pageCount, setPageCount] = useState(1);
	const [activePage, setActivePage] = useState(0);

	/** Re-reads the page count and which page the scroll position is on. */
	const sync = useCallback(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const { pageCount: pages, page } = readState(scroller);
		setPageCount(pages);
		setActivePage(page);
	}, []);

	useEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return undefined;
		sync();
		scroller.addEventListener('scroll', sync, { passive: true });
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
		observer?.observe(scroller);
		return () => {
			scroller.removeEventListener('scroll', sync);
			observer?.disconnect();
		};
	}, [sync]);

	// The slide list changes on every refresh / deletion.
	useEffect(() => sync(), [children, sync]);

	/** Scrolls to the start of a page (the last page is clamped at the end of the track). */
	const goToPage = useCallback((page: number) => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const { perView, pitch, pageCount: pages, maxPosition, rtl } = readState(scroller);
		const target = Math.min(Math.min(Math.max(page, 0), pages - 1) * perView * pitch, maxPosition);
		scroller.scrollTo({ left: rtl ? -target : target, behavior: 'smooth' });
	}, []);

	/**
	 * The arrows step to the neighbouring PAGE, not one group from the current offset: the last
	 * page is clamped at the end of the track, so subtracting a group from there would skip a page
	 * and leave the arrows and the bullets disagreeing.
	 */
	const stepPage = useCallback(
		(direction: 1 | -1) => {
			const scroller = scrollerRef.current;
			if (!scroller) return;
			goToPage(readState(scroller).page + direction);
		},
		[goToPage]
	);

	useImperativeHandle(
		ref,
		() => ({
			slideNext: () => stepPage(1),
			slidePrev: () => stepPage(-1)
		}),
		[stepPage]
	);

	return (
		<div className={`gz-rtt-carousel-wrap${className ? ` ${className}` : ''}`}>
			<div
				ref={scrollerRef}
				className="gz-rtt-carousel"
				style={{ '--gz-rtt-slides': slidesPerView } as React.CSSProperties}
				data-slides-per-view={slidesPerView}
			>
				<div className="gz-rtt-carousel-track">{children}</div>
			</div>
			{pageCount > 1 ? (
				<div className="gz-rtt-carousel-pagination">
					{Array.from({ length: pageCount }, (_, page) => (
						<button
							type="button"
							key={page}
							className={`gz-rtt-carousel-bullet${page === activePage ? ' active' : ''}`}
							aria-label={`${page + 1} / ${pageCount}`}
							aria-current={page === activePage ? 'true' : undefined}
							onClick={() => goToPage(page)}
						/>
					))}
				</div>
			) : null}
		</div>
	);
});
