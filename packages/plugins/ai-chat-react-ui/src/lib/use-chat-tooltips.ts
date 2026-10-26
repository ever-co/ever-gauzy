import { useEffect, type RefObject } from 'react';

/** Gap between the trigger and the bubble. */
const OFFSET = 6;
/** Closest the bubble may sit to a viewport edge. */
const EDGE = 4;
/**
 * The horizontal shift `.tooltip-container` applies through its own `transform` (and its
 * `tooltip-slide` keyframes, which an inline style cannot override). Compensated for below so the
 * bubble lands centred on the trigger.
 */
const CONTAINER_SHIFT_X = 16.75;
/** The vertical shift the same transform applies, as a fraction of the bubble's own height. */
const CONTAINER_SHIFT_Y = 1.185;

/** Where a trigger keeps its tooltip text once the native `title` has been taken off it. */
const TEXT_ATTR = 'data-gz-tooltip';

/**
 * The tooltip text of an element, taking it over from a native `title` the first time it is seen.
 *
 * The native tooltip would otherwise show as well, a second later, in the browser's own style. An
 * element whose only accessible name was its `title` keeps it as an `aria-label`.
 */
function claimTooltipText(element: HTMLElement): string {
	const title = element.getAttribute('title');
	if (title) {
		element.removeAttribute('title');
		element.setAttribute(TEXT_ATTR, title);
		if (!element.hasAttribute('aria-label') && !element.textContent?.trim()) {
			element.setAttribute('aria-label', title);
		}
		return title;
	}
	return element.getAttribute(TEXT_ATTR) ?? '';
}

/**
 * useChatTooltips
 *
 * Gives every trigger inside the chat the app's own tooltip — the `.tooltip-container` bubble the
 * collapsed sidebar menu shows through the `gaTooltip` directive — instead of the browser's native
 * `title` tooltip. One delegated listener on the panel root covers every control that has a
 * `title`, present or future, so no button has to opt in.
 *
 * Shown on hover and on keyboard focus (`:focus-visible` only, so a mouse click does not leave a
 * bubble hanging); hidden on leave, blur, press, scroll and Escape. Placed above the trigger,
 * flipped below when there is no room, and clamped inside the viewport — the chat is docked at a
 * screen edge, where an unclamped bubble would be cut off.
 */
export function useChatTooltips(rootRef: RefObject<HTMLElement | null>): void {
	useEffect(() => {
		const root = rootRef.current;
		if (!root || typeof document === 'undefined') return;

		let popup: HTMLDivElement | null = null;
		let current: HTMLElement | null = null;

		const hide = () => {
			popup?.remove();
			popup = null;
			current = null;
		};

		const show = (trigger: HTMLElement) => {
			const text = claimTooltipText(trigger);
			if (!text) return;
			hide();
			current = trigger;

			const bubble = document.createElement('div');
			bubble.className = 'tooltip-container';
			bubble.setAttribute('role', 'tooltip');
			// Text node, never HTML — the same rule the gaTooltip directive follows.
			bubble.appendChild(document.createTextNode(text));
			bubble.style.whiteSpace = 'nowrap';
			bubble.style.visibility = 'hidden';
			document.body.appendChild(bubble);
			popup = bubble;

			// Measured once in the DOM: its size depends on the text and the theme's font.
			const width = bubble.offsetWidth;
			const height = bubble.offsetHeight;
			const rect = trigger.getBoundingClientRect();

			let left = rect.left + rect.width / 2 - width / 2;
			left = Math.min(Math.max(left, EDGE), window.innerWidth - width - EDGE);
			let top = rect.top - OFFSET - height;
			if (top < EDGE) top = rect.bottom + OFFSET;

			// `.tooltip-container` is positioned against the document and shifted by its transform;
			// undo both so the bubble's final box is exactly `left` / `top` above.
			bubble.style.left = `${left + window.scrollX + CONTAINER_SHIFT_X}px`;
			bubble.style.top = `${top + window.scrollY + height * CONTAINER_SHIFT_Y}px`;
			bubble.style.visibility = '';
		};

		const triggerFrom = (target: EventTarget | null): HTMLElement | null => {
			const element = target instanceof Element ? target.closest<HTMLElement>(`[title], [${TEXT_ATTR}]`) : null;
			// A frame's `title` names it for screen readers; a bubble over an embedded PDF is noise.
			if (!element || element.tagName === 'IFRAME') return null;
			return root.contains(element) ? element : null;
		};

		const onMouseOver = (event: MouseEvent) => {
			const trigger = triggerFrom(event.target);
			if (trigger && trigger !== current) show(trigger);
			else if (!trigger && current) hide();
		};
		const onMouseOut = (event: MouseEvent) => {
			if (!current) return;
			const next = event.relatedTarget;
			if (!(next instanceof Node) || !current.contains(next)) hide();
		};
		const onFocusIn = (event: FocusEvent) => {
			const trigger = triggerFrom(event.target);
			if (trigger && trigger === event.target && trigger.matches(':focus-visible')) show(trigger);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') hide();
		};

		root.addEventListener('mouseover', onMouseOver);
		root.addEventListener('mouseout', onMouseOut);
		root.addEventListener('focusin', onFocusIn);
		root.addEventListener('focusout', hide);
		// A press usually swaps or removes the trigger (mic → recorder, chip → preview), and a
		// removed element never fires `mouseout`.
		root.addEventListener('pointerdown', hide);
		root.addEventListener('keydown', onKeyDown);
		// Capture: the scroll happens in inner containers, not on the root.
		window.addEventListener('scroll', hide, true);
		window.addEventListener('resize', hide);

		return () => {
			root.removeEventListener('mouseover', onMouseOver);
			root.removeEventListener('mouseout', onMouseOut);
			root.removeEventListener('focusin', onFocusIn);
			root.removeEventListener('focusout', hide);
			root.removeEventListener('pointerdown', hide);
			root.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('scroll', hide, true);
			window.removeEventListener('resize', hide);
			hide();
		};
	}, [rootRef]);
}
