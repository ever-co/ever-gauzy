import { DestroyRef, Directive, inject } from '@angular/core';
import { ConnectedPosition, FlexibleConnectedPositionStrategy, OverlayRef } from '@angular/cdk/overlay';
import { NgSelectComponent } from '@ng-select/ng-select';

/**
 * Where an entity-select panel may sit, in order of preference: below the trigger, start-aligned
 * (ng-select's own default), then end-aligned, then the same two above it. The end-aligned pair
 * is what keeps a widened panel on screen when its trigger sits near the right edge — the
 * header's organization pill is 52 px from it.
 */
export const ENTITY_SELECT_PANEL_POSITIONS: ConnectedPosition[] = [
	{ originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
	{ originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
	{ originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
	{ originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' }
];

/** The `dropdownPosition` values that ask for the panel above the trigger first. */
const ABOVE_FIRST = new Set(['top']);

/**
 * Lets an entity selector's dropdown panel be WIDER than its trigger, without changing the
 * trigger (owner, 2026-10-13: "only the expanded panel should become wider … the collapsed
 * control keeps its current width").
 *
 * Since ng-select 24 the panel lives in a CDK overlay pane that ng-select sizes to the trigger's
 * width on every open and on every trigger resize. The pane's WIDTH is therefore taken over in
 * CSS (`_overrides.scss`, `.cdk-overlay-pane:has(> .ng-dropdown-panel.gauzy-entity-select)`:
 * `max-content`, capped at `min(32rem, 100vw − 2rem)`), because an `!important` rule is the only
 * thing ng-select's repeated `updateSize({ width })` cannot undo, and its floor (the trigger's
 * width) comes from `NgSelectPanelSizingService`. What neither can do is move the panel: the CDK
 * positions it start-aligned under the trigger, so a panel that grew past the viewport edge would
 * be cut. This directive adds the end-aligned positions plus push to the overlay's position
 * strategy, so the panel flips or slides back into view instead.
 *
 * `dropdownOverlayRef` is a protected member of `NgSelectComponent` (set just before the overlay
 * attaches); it is read through an index because ng-select has no public handle on its overlay.
 * If a future ng-select drops it, this directive does nothing and the CSS still widens the panel.
 */
@Directive({
	selector: 'ng-select.gauzy-entity-select',
	standalone: true
})
export class EntitySelectPanelDirective {
	private readonly select = inject(NgSelectComponent);

	constructor() {
		// `openEvent` fires BEFORE ng-select attaches and sizes the overlay, so the adjustment
		// runs once the current open has finished.
		const subscription = this.select.openEvent.subscribe(() => queueMicrotask(() => this.adjust()));
		inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
	}

	/** Applies the edge-aware positions to the open panel. */
	adjust(): void {
		const overlayRef = (this.select as unknown as { dropdownOverlayRef?: OverlayRef | null })['dropdownOverlayRef'];
		if (!overlayRef?.hasAttached()) {
			return;
		}
		const strategy = overlayRef.getConfig().positionStrategy;
		if (strategy instanceof FlexibleConnectedPositionStrategy) {
			const position = String((this.select as unknown as { dropdownPosition?: () => string }).dropdownPosition?.() ?? 'auto');
			const positions = ABOVE_FIRST.has(position)
				? [...ENTITY_SELECT_PANEL_POSITIONS.slice(2), ...ENTITY_SELECT_PANEL_POSITIONS.slice(0, 2)]
				: ENTITY_SELECT_PANEL_POSITIONS;
			strategy.withPositions(positions).withPush(true);
		}
		overlayRef.updatePosition();
	}
}
