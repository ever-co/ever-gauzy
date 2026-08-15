import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { useInjectedStyles } from '../helpers/inject-styles';

export type PopoverPlacement = 'bottom' | 'bottom-start' | 'bottom-end' | 'top';

export interface PopoverProps {
	/** The trigger; clicking it toggles the panel (Nebular `nbPopoverTrigger="click"`). */
	children: ReactNode;
	/** Panel content. */
	content: ReactNode;
	placement?: PopoverPlacement;
	/** Controlled open state; omit for uncontrolled. */
	open?: boolean;
	/** Fired on every open/close, including outside clicks and Escape. */
	onOpenChange?: (open: boolean) => void;
	/** Gap between trigger and panel, in px (Nebular's arrow size). */
	offset?: number;
	/** Class applied to the trigger wrapper. */
	className?: string;
	/** Class applied to the floating panel. */
	panelClassName?: string;
	panelStyle?: CSSProperties;
	/** Trigger wrapper display; `inline-flex` by default so it hugs a button. */
	display?: CSSProperties['display'];
	/** z-index of the floating panel; defaults to Nebular's overlay level. */
	zIndex?: number;
	/**
	 * Accessible name of the panel (`aria-label` on the `dialog`). Give one whenever the panel is
	 * not self-describing — screen readers announce it when focus moves in.
	 */
	panelLabel?: string;
}

const POPOVER_CSS = `
.gzrc-popover-panel { position: fixed; box-sizing: border-box; max-width: calc(100vw - 16px);
	background: var(--popover-background-color); color: var(--popover-text-color);
	border: var(--popover-border-width) solid var(--popover-border-color); border-radius: var(--popover-border-radius);
	box-shadow: var(--popover-shadow); font-family: var(--popover-text-font-family); font-size: var(--popover-text-font-size);
	font-weight: var(--popover-text-font-weight); line-height: var(--popover-text-line-height); }
.gzrc-popover-arrow { position: absolute; width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; }
.gzrc-popover-panel[data-placement^="bottom"] .gzrc-popover-arrow { top: -8px; border-bottom: 8px solid var(--popover-border-color); }
.gzrc-popover-panel[data-placement^="bottom"] .gzrc-popover-arrow::after { content: ''; position: absolute; left: -8px; top: 1px;
	border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 8px solid var(--popover-background-color); }
.gzrc-popover-panel[data-placement="top"] .gzrc-popover-arrow { bottom: -8px; border-top: 8px solid var(--popover-border-color); }
.gzrc-popover-panel[data-placement="top"] .gzrc-popover-arrow::after { content: ''; position: absolute; left: -8px; bottom: 1px;
	border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 8px solid var(--popover-background-color); }
`;

interface PanelPosition {
	top: number;
	left: number;
	arrowLeft: number;
}

/**
 * Computes the fixed-position coordinates of a panel anchored to a trigger rectangle.
 *
 * Pure so it can be unit-tested: `bottom` centres the panel under the trigger, `bottom-start` /
 * `bottom-end` align its edges, `top` centres it above; the result is clamped to the viewport
 * with an 8px margin and the arrow keeps pointing at the trigger centre.
 *
 * @param trigger Trigger `DOMRect`-like box.
 * @param panel Panel width/height.
 * @param viewport Viewport width/height.
 * @param placement Requested placement.
 * @param offset Gap between trigger and panel.
 */
export function computePopoverPosition(
	trigger: { top: number; left: number; width: number; height: number },
	panel: { width: number; height: number },
	viewport: { width: number; height: number },
	placement: PopoverPlacement,
	offset: number
): PanelPosition {
	const margin = 8;
	const triggerCenter = trigger.left + trigger.width / 2;
	let left: number;
	switch (placement) {
		case 'bottom-start':
			left = trigger.left;
			break;
		case 'bottom-end':
			left = trigger.left + trigger.width - panel.width;
			break;
		default:
			left = triggerCenter - panel.width / 2;
	}
	left = Math.max(margin, Math.min(left, viewport.width - panel.width - margin));
	const top =
		placement === 'top'
			? Math.max(margin, trigger.top - panel.height - offset)
			: Math.min(trigger.top + trigger.height + offset, Math.max(margin, viewport.height - panel.height - margin));
	const arrowLeft = Math.max(12, Math.min(triggerCenter - left, panel.width - 12));
	return { top, left, arrowLeft };
}

/**
 * Popover — click-toggled floating panel in the style of `[nbPopover]`.
 *
 * The panel is portaled to `document.body` and positioned `fixed`, so it is never clipped by an
 * `overflow: hidden` card. It closes on outside click and on Escape; both go through
 * `onOpenChange`, so a consumer that persists state "when the popover closes" (the Angular
 * widgets save their layout on `clickOutside`) can hook there.
 */
export function Popover({
	children,
	content,
	placement = 'bottom',
	open,
	onOpenChange,
	offset = 8,
	className,
	panelClassName,
	panelStyle,
	display = 'inline-flex',
	zIndex = 1000,
	panelLabel
}: PopoverProps) {
	useInjectedStyles('gzrc-popover-styles', POPOVER_CSS);
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const isControlled = open !== undefined;
	const isOpen = isControlled ? !!open : uncontrolledOpen;
	const triggerRef = useRef<HTMLSpanElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<PanelPosition | null>(null);

	const setOpen = useCallback(
		(next: boolean) => {
			if (!isControlled) setUncontrolledOpen(next);
			onOpenChange?.(next);
		},
		[isControlled, onOpenChange]
	);

	const reposition = useCallback(() => {
		const trigger = triggerRef.current;
		const panel = panelRef.current;
		if (!trigger || !panel) return;
		const rect = trigger.getBoundingClientRect();
		const next = computePopoverPosition(
			rect,
			{ width: panel.offsetWidth, height: panel.offsetHeight },
			{ width: window.innerWidth, height: window.innerHeight },
			placement,
			offset
		);
		setPosition((prev) =>
			prev && prev.top === next.top && prev.left === next.left && prev.arrowLeft === next.arrowLeft ? prev : next
		);
	}, [placement, offset]);

	useLayoutEffect(() => {
		if (!isOpen) {
			setPosition(null);
			return;
		}
		reposition();
	}, [isOpen, reposition, content]);

	useEffect(() => {
		if (!isOpen) return;
		const onPointerDown = (event: MouseEvent) => {
			const target = event.target as Node;
			if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
			setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false);
		};
		document.addEventListener('mousedown', onPointerDown, true);
		document.addEventListener('keydown', onKeyDown);
		window.addEventListener('resize', reposition);
		window.addEventListener('scroll', reposition, true);
		return () => {
			document.removeEventListener('mousedown', onPointerDown, true);
			document.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('resize', reposition);
			window.removeEventListener('scroll', reposition, true);
		};
	}, [isOpen, reposition, setOpen]);

	return (
		<>
			{/* The wrapper is the click target for whatever trigger the caller renders (usually a
			    button, which is already focusable). It publishes the disclosure state for AT and,
			    when the child is NOT an interactive control, takes focus + Enter/Space itself. */}
			<span
				ref={triggerRef}
				className={className}
				style={{ display }}
				aria-haspopup="dialog"
				aria-expanded={isOpen}
				onClick={() => setOpen(!isOpen)}
				onKeyDown={(event) => {
					if (event.target !== event.currentTarget) return;
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						setOpen(!isOpen);
					}
				}}
				tabIndex={hasInteractiveChild(triggerRef.current) ? undefined : 0}
				role={hasInteractiveChild(triggerRef.current) ? undefined : 'button'}
			>
				{children}
			</span>
			{isOpen && typeof document !== 'undefined'
				? createPortal(
						<div
							ref={panelRef}
							className={`gzrc-popover-panel${panelClassName ? ` ${panelClassName}` : ''}`}
							data-placement={placement}
							role="dialog"
							aria-label={panelLabel}
							style={{
								top: position?.top ?? 0,
								left: position?.left ?? 0,
								visibility: position ? 'visible' : 'hidden',
								zIndex,
								...panelStyle
							}}
						>
							<span className="gzrc-popover-arrow" style={{ left: (position?.arrowLeft ?? 0) - 8 }} />
							{content}
						</div>,
						document.body
					)
				: null}
		</>
	);
}

/** Whether the trigger wrapper already contains a natively focusable control (button, link, input…). */
function hasInteractiveChild(element: HTMLElement | null): boolean {
	// Before the first render there is nothing to inspect: assume the common case (a button child).
	if (!element) return true;
	return !!element.querySelector('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
}
