import { Component } from '@angular/core';
@Component({
	selector: 'ga-edit-candidate-location',
	template: `
		<ga-employee-location [isCandidate]="true"></ga-employee-location>
	`
})
export class EditCandidateLocationComponent {}
