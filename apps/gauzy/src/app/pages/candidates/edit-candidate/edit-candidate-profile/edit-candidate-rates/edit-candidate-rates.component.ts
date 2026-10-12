import { Component } from '@angular/core';

@Component({
    selector: 'ga-edit-candidate-rates',
    template: ` <ga-employee-rates [isCandidate]="true"></ga-employee-rates> `,
    styles: [
        `
			:host {
				display: flex;
				flex-direction: column;
				overflow-y: auto;
				/*
				 * The candidate tabset is not a flex chain (its nb-card-body is a
				 * fixed 100vh - 20rem with overflow: unset), so unlike the employee
				 * side this host is the only thing bounding the panel — every sibling
				 * candidate tab carries the same cap. The max() floor keeps it from
				 * resolving to a non-positive length, and collapsing the panel to
				 * nothing, on viewports shorter than 28rem.
				 */
				max-height: max(20rem, calc(100vh - 28rem));
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
