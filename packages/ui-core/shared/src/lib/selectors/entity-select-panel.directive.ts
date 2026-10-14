import { DestroyRef, Directive, Injector, afterNextRender, inject } from '@angular/core';
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

/** Marks a position strategy this directive has already taught the end-aligned fallbacks. */
const AUGMENTED = Symbol('gauzyEntitySelectPositions');

/**
 * Every start-aligned position followed by its end-aligned twin, in the order given — so ng-select's
 * own preference (`auto`: below then above; `top`: above only) is kept, and each side gets a
 * fallback that grows towards the middle of the screen.
 */
export function withEndAlignedFallbacks(positions: readonly ConnectedPosition[]): ConnectedPosition[] {
	return positions.flatMap((position) =>
		position.originX === 'start' && position.overlayX === 'start'
			? [position, { ...position, originX: 'end', overlayX: 'end' } as ConnectedPosition]
			: [position]
	);
}

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
 * ng-select re-applies its own (start-aligned) position list from an `effect` every time the panel
 * opens — after `(open)` has fired — so setting the list once would be overwritten. The directive
 * therefore wraps the strategy's `withPositions` once: whatever list ng-select sets from then on
 * arrives with its end-aligned twins ({@link withEndAlignedFallbacks}).
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
	private readonly injector = inject(Injector);

	constructor() {
		// `openEvent` fires BEFORE ng-select attaches the overlay — the attach happens in an effect
		// during the change detection the open schedules — so the adjustment waits for that render.
		const subscription = this.select.openEvent.subscribe(() =>
			afterNextRender({ write: () => this.adjust() }, { injector: this.injector })
		);
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
			const augmentable = strategy as FlexibleConnectedPositionStrategy & { [AUGMENTED]?: true };
			if (!augmentable[AUGMENTED]) {
				const setPositions = strategy.withPositions.bind(strategy);
				strategy.withPositions = (positions: ConnectedPosition[]) => setPositions(withEndAlignedFallbacks(positions));
				augmentable[AUGMENTED] = true;
			}
			// Re-state the list ng-select set for this open, through the wrapper.
			strategy.withPositions(strategy.positions.filter((p) => !(p.originX === 'end' && p.overlayX === 'end'))).withPush(true);
		}
		overlayRef.updatePosition();
	}
}
