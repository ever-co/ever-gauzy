import { Component } from '@angular/core';

@Component({
    selector: 'ga-edit-employee-rates',
    template: `
		<ga-employee-rates [isEmployee]="true"></ga-employee-rates>
	`,
    styles: [
        /*
         * The tabset hands this tab the height the card body has left over
         * (edit-employee-profile.component.scss), so there is nothing here left
         * to measure: the `height: calc(100vh - 20.5rem)` this used to carry was
         * a second guess at the page chrome alongside the card's own, and when
         * the two disagreed the tab stopped short and left a band of bare card
         * body under the form.
         *
         * The tab surface is painted here rather than left to `ga-employee-rates`,
         * which paints its own two panels: without a fill on the tab, the gutter
         * between and around them showed the card body straight through.
         *
         * `ga-employee-rates` is shared with the candidate pages, so its own
         * `height: 100%` — a percentage of a host sized by flex layout, which the
         * cascade cannot resolve — is overridden only for this tab.
         * `flex-shrink: 0` because the host scrolls: a form taller than the tab
         * keeps its height and scrolls inside the host.
         */
        `
			:host {
				background-color: var(--gauzy-card-2);
				display: flex;
				flex-direction: column;
				overflow-y: auto;
			}

			:host > ga-employee-rates {
				display: flex;
				flex-direction: column;
				height: auto;
				flex: 1 0 auto;
			}
		`
    ],
    standalone: false
})
export class EditEmployeeRatesComponent {}
