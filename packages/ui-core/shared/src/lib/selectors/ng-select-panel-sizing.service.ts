import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, OnDestroy, inject, provideAppInitializer, type EnvironmentProviders } from '@angular/core';

/**
 * The CSS custom property every ng-select overlay pane carries: the width of the select it
 * belongs to. `_overrides.scss` uses it as the pane's `min-width`.
 */
export const NG_SELECT_TRIGGER_WIDTH_VAR = '--gauzy-ng-select-trigger-width';

/**
 * Restores "a dropdown panel is never narrower than its select" for every ng-select in the app.
 *
 * Before ng-select 24 an appended panel carried an inline `min-width` equal to its trigger, and
 * `_overrides.scss` relied on it as the floor under "as wide as the widest option" (CSS 2.1
 * §10.4: `min-width` beats `max-width`). ng-select 24 renders the panel inside a CDK overlay pane
 * and sets only the pane's `width` — which the stylesheet has to override to let the panel grow —
 * so the floor was gone, and there is no stylesheet way to know a trigger's width.
 *
 * This service supplies it: it watches the overlay containers (only `<body>`'s direct children,
 * then each container's subtree) and, whenever an `ng-dropdown-panel` is attached, finds its
 * select through ARIA — the panel's `role="listbox"` element has the id the open select's input
 * names in `aria-controls` — and writes that select's width to {@link NG_SELECT_TRIGGER_WIDTH_VAR}
 * on the pane. A custom property is used rather than `style.minWidth` because the CDK rewrites
 * `minWidth` from its own config on every `updateSize()` call, which ng-select makes on each open
 * and on every trigger resize; it never touches custom properties. While the panel is open the
 * select is also watched for size changes (a full-width form field on a window resize), so the floor
 * follows the control rather than keeping the width it had when the panel opened.
 *
 * Runs outside the Angular zone: it only writes a style, so it must not trigger change detection.
 */
@Injectable({ providedIn: 'root' })
export class NgSelectPanelSizingService implements OnDestroy {
	private readonly document = inject(DOCUMENT);
	private readonly zone = inject(NgZone);
	private bodyObserver: MutationObserver | null = null;
	private readonly containers = new Map<Element, MutationObserver>();
	/** One size watch per open panel's select; dropped when the panel leaves the document. */
	private readonly triggerWatches = new Map<Element, { select: Element; observer: ResizeObserver }>();

	/** Starts watching (idempotent; a no-op where `MutationObserver` does not exist, e.g. SSR). */
	start(): void {
		if (this.bodyObserver || typeof MutationObserver === 'undefined' || !this.document?.body) {
			return;
		}
		this.zone.runOutsideAngular(() => {
			const body = this.document.body;
			Array.from(body.children)
				.filter((child) => child.classList.contains('cdk-overlay-container'))
				.forEach((container) => this.watch(container));
			this.bodyObserver = new MutationObserver((records) => {
				for (const record of records) {
					record.addedNodes.forEach((node) => {
						if (node instanceof Element && node.classList.contains('cdk-overlay-container')) {
							this.watch(node);
						}
					});
				}
			});
			this.bodyObserver.observe(body, { childList: true });
		});
	}

	ngOnDestroy(): void {
		this.bodyObserver?.disconnect();
		this.bodyObserver = null;
		this.containers.forEach((observer) => observer.disconnect());
		this.containers.clear();
		this.triggerWatches.forEach(({ observer }) => observer.disconnect());
		this.triggerWatches.clear();
	}

	/**
	 * Writes the trigger width onto the pane that holds `panel`.
	 *
	 * @returns The width written, or `null` when the panel's select could not be found.
	 */
	sizePanel(panel: Element): number | null {
		const pane = panel.parentElement;
		const listboxId = panel.querySelector('[role="listbox"]')?.id;
		if (!pane || !pane.classList.contains('cdk-overlay-pane') || !listboxId) {
			return null;
		}
		const input = this.document.querySelector(`[aria-controls="${cssEscape(listboxId)}"]`);
		const select = input?.closest('ng-select');
		const width = select?.getBoundingClientRect().width ?? 0;
		if (!(width > 0)) {
			return null;
		}
		(pane as HTMLElement).style.setProperty(NG_SELECT_TRIGGER_WIDTH_VAR, `${width}px`);
		this.watchTrigger(panel, select as Element);
		return width;
	}

	/**
	 * Keeps the pane's floor equal to the select's width while `panel` is open, and stops as soon as
	 * the panel has left the document (closed) — checked on every notification and on every attach.
	 */
	private watchTrigger(panel: Element, select: Element): void {
		this.dropDetachedWatches();
		if (typeof ResizeObserver === 'undefined' || this.triggerWatches.get(panel)?.select === select) {
			return;
		}
		this.triggerWatches.get(panel)?.observer.disconnect();
		const observer = new ResizeObserver(() => {
			if (!panel.isConnected) {
				observer.disconnect();
				this.triggerWatches.delete(panel);
				return;
			}
			const width = select.getBoundingClientRect().width;
			if (width > 0) {
				panel.parentElement?.style.setProperty(NG_SELECT_TRIGGER_WIDTH_VAR, `${width}px`);
			}
		});
		observer.observe(select);
		this.triggerWatches.set(panel, { select, observer });
	}

	/** Disconnects the watches of panels that were closed (removed from the document) since. */
	private dropDetachedWatches(): void {
		this.triggerWatches.forEach(({ observer }, panel) => {
			if (!panel.isConnected) {
				observer.disconnect();
				this.triggerWatches.delete(panel);
			}
		});
	}

	private watch(container: Element): void {
		if (this.containers.has(container)) {
			return;
		}
		const observer = new MutationObserver((records) => {
			if (records.some((record) => record.removedNodes.length > 0)) {
				this.dropDetachedWatches();
			}
			// Option rows render and re-render while a panel is open (scrolling, filtering); only an
			// attach — a panel, or something containing one, being added — needs a measurement.
			const attached = records.some((record) =>
				Array.from(record.addedNodes).some(
					(node) =>
						node instanceof Element &&
						(node.matches('ng-dropdown-panel') || !!node.querySelector('ng-dropdown-panel'))
				)
			);
			if (attached) {
				container.querySelectorAll('.cdk-overlay-pane > ng-dropdown-panel').forEach((panel) => this.sizePanel(panel));
			}
		});
		observer.observe(container, { childList: true, subtree: true });
		this.containers.set(container, observer);
		container.querySelectorAll('.cdk-overlay-pane > ng-dropdown-panel').forEach((panel) => this.sizePanel(panel));
	}
}

/** `CSS.escape` where it exists (every browser), a minimal quote-escape otherwise (jsdom). */
function cssEscape(value: string): string {
	return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}

/** Registers {@link NgSelectPanelSizingService} at application start. */
export function provideNgSelectPanelSizing(): EnvironmentProviders {
	return provideAppInitializer(() => inject(NgSelectPanelSizingService).start());
}
