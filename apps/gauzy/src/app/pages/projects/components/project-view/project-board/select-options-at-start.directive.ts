import { Directive, inject } from '@angular/core';
import { NbLayoutDirectionService, NbPosition, NbSelectComponent } from '@nebular/theme';

/**
 * Where the options open, the first that fits: below the trigger, else above it, from its start edge; failing that,
 * from its end edge, for a trigger too near the screen's far side. Nebular names these after the side the overlay
 * grows towards, so `_END` is what lines up the start edges.
 */
const OPTIONS_POSITIONS = [NbPosition.BOTTOM_END, NbPosition.TOP_END, NbPosition.BOTTOM_START, NbPosition.TOP_START];

/**
 * Opens an `nb-select`'s options from the start edge of its trigger, for a menu wider than the trigger: `NbSelect`
 * always centres them, with no input to say otherwise. It builds its position once, on first opening, so swapping the
 * method here is in time. Nebular's adjustments that reach these positions cycle through centred and side ones too, so
 * the strategy is given its own list, and pushed back on screen when none fits, which Nebular's builder turns off.
 */
@Directive({
	selector: 'nb-select[gaOptionsAtStart]',
	standalone: true
})
export class SelectOptionsAtStartDirective {
	constructor() {
		// `createPositionStrategy` and `positionBuilder` are protected: the select offers no public way in.
		const select = inject(NbSelectComponent) as any;
		const layoutDirection = inject(NbLayoutDirectionService);
		select.createPositionStrategy = () => {
			const strategy = select.positionBuilder
				.connectedTo(select.button)
				.offset(select.optionsOverlayOffset)
				.direction(layoutDirection.getDirection())
				.withPush(true);
			strategy.createPositions = () => OPTIONS_POSITIONS;
			return strategy;
		};
	}
}
