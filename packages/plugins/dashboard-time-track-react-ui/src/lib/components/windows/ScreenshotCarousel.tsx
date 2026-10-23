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

/** Visible slides, slide pitch and page count of the scroller, measured from the DOM. */
interface CarouselMetrics {
	perView: number;
	pitch: number;
	pageCount: number;
}

/**
 * Measures the scroller: how many slides are visible right now, the distance from one slide to
 * the next, and how many pages of visible slides there are.
 *
 * @param scroller The scrolling element.
 */
function measure(scroller: HTMLElement): CarouselMetrics {
	const slides = scroller.querySelectorAll<HTMLElement>('.gz-rtt-carousel-slide');
	// The gap lives in ONE place — the `--gz-rtt-slide-gap` custom property in styles.ts.
	const gap = parseFloat(getComputedStyle(scroller).getPropertyValue('--gz-rtt-slide-gap')) || 8;
	const pitch = slides.length > 0 ? slides[0].offsetWidth + gap : scroller.clientWidth;
	const perView = Math.max(1, Math.floor((scroller.clientWidth + gap) / Math.max(pitch, 1)));
	return { perView, pitch, pageCount: Math.max(1, Math.ceil(slides.length / perView)) };
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
		const { perView, pitch, pageCount: pages } = measure(scroller);
		const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1;
		const page = atEnd ? pages - 1 : Math.round(scroller.scrollLeft / (pitch * perView));
		setPageCount(pages);
		setActivePage(Math.min(Math.max(page, 0), pages - 1));
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

	const goToPage = useCallback((page: number) => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const { perView, pitch } = measure(scroller);
		scroller.scrollTo({ left: page * perView * pitch, behavior: 'smooth' });
	}, []);

	const scrollByGroup = useCallback((direction: 1 | -1) => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const { perView, pitch } = measure(scroller);
		scroller.scrollBy({ left: perView * pitch * direction, behavior: 'smooth' });
	}, []);

	useImperativeHandle(
		ref,
		() => ({
			slideNext: () => scrollByGroup(1),
			slidePrev: () => scrollByGroup(-1)
		}),
		[scrollByGroup]
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
