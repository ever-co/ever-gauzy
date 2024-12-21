import { Component } from '@angular/core';
@Component({
    selector: 'ga-edit-candidate-location',
    template: `
		<ga-employee-location [isCandidate]="true"></ga-employee-location>
	`,
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
export class EditCandidateLocationComponent {}
