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
