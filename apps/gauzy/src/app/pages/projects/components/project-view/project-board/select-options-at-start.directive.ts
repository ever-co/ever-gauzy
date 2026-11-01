import { Directive, inject } from '@angular/core';
import { NbAdjustment, NbLayoutDirectionService, NbPosition, NbSelectComponent } from '@nebular/theme';

/**
 * Opens an `nb-select`'s options from the start edge of its trigger, for a menu wider than the trigger: `NbSelect`
 * always centres them, with no input to say otherwise. It builds its position once, on first opening, so swapping the
 * method here is in time. Its `VERTICAL` adjustment only knows centred positions, so the menu always opens below the
 * trigger; this suits a control near the top of the page.
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
		select.createPositionStrategy = () =>
			select.positionBuilder
				.connectedTo(select.button)
				// Nebular names these after the side the overlay grows towards: `BOTTOM_END` lines up the start edges.
				.position(NbPosition.BOTTOM_END)
				.offset(select.optionsOverlayOffset)
				.adjustment(NbAdjustment.NOOP)
				.direction(layoutDirection.getDirection());
	}
}
