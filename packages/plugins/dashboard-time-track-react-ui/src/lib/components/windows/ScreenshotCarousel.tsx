import { forwardRef, useCallback, useImperativeHandle, useRef, type ReactNode } from 'react';

/** Imperative handle mirroring the two Swiper calls the Angular template makes. */
export interface ScreenshotCarouselHandle {
	slideNext: () => void;
	slidePrev: () => void;
}

export interface ScreenshotCarouselProps {
	/** One slide per child (each `<swiper-slide>`). */
	children: ReactNode;
	/** Slides per view / per group (Angular: `slides-per-view="3" slides-per-group="3"`). */
	slidesPerView?: number;
	className?: string;
}

/**
 * A dependency-free stand-in for `<swiper-container slides-per-view="3" space-between="16"
 * slides-per-group="3">`: a horizontally scrolling, scroll-snapping track showing three slides
 * per view with a 16px gap; `slideNext()` / `slidePrev()` scroll by one group (three slides),
 * which is what the prev/next arrows in the Recent Activities header call.
 */
export const ScreenshotCarousel = forwardRef<ScreenshotCarouselHandle, ScreenshotCarouselProps>(function ScreenshotCarousel(
	{ children, slidesPerView = 3, className },
	ref
) {
	const scrollerRef = useRef<HTMLDivElement>(null);

	const scrollByGroup = useCallback(
		(direction: 1 | -1) => {
			const scroller = scrollerRef.current;
			if (!scroller) return;
			// One group = the visible width (three slides + gaps).
			const distance = scroller.clientWidth * direction;
			scroller.scrollBy({ left: distance, behavior: 'smooth' });
		},
		[]
	);

	useImperativeHandle(
		ref,
		() => ({
			slideNext: () => scrollByGroup(1),
			slidePrev: () => scrollByGroup(-1)
		}),
		[scrollByGroup]
	);

	return (
		<div ref={scrollerRef} className={`gz-rtt-carousel${className ? ` ${className}` : ''}`} data-slides-per-view={slidesPerView}>
			<div className="gz-rtt-carousel-track">{children}</div>
		</div>
	);
});
