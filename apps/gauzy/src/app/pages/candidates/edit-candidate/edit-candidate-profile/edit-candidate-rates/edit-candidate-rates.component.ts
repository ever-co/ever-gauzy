import { Component } from '@angular/core';

@Component({
    selector: 'ga-edit-candidate-rates',
    template: ` <ga-employee-rates [isCandidate]="true"></ga-employee-rates> `,
    styles: [
        `
			:host {
				overflow-y: auto;
				max-height: calc(100vh - 28rem);
			}
		`
    ],
    standalone: false
})
export class EditCandidateRatesComponent {}
