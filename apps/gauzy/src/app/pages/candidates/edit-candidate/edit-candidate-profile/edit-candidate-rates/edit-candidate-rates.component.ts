import { Component } from '@angular/core';

@Component({
    selector: 'ga-edit-candidate-rates',
    template: ` <ga-employee-rates [isCandidate]="true"></ga-employee-rates> `,
    /*
     * `ga-employee-rates` is shared with the employee page, where it was rebuilt
     * from two nested `nb-card`s into two flat panels on the tab surface. Panels
     * need a surface to sit on: without a fill here the 1rem gutter between and
     * around them showed this page's card body straight through. The flex column
     * is what lets them stand on the height this host is given.
     *
     * `max-height: calc(100vh - 28rem)` is this page's own chrome arithmetic and
     * is left alone — the employee tabset sizes its tabs from the card body
     * instead, but that chain does not exist here.
     */
    styles: [
        `
			:host {
				display: flex;
				flex-direction: column;
				overflow-y: auto;
				max-height: calc(100vh - 28rem);
				background-color: var(--gauzy-card-2);
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
export class EditCandidateRatesComponent {}
