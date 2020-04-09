import { Component } from '@angular/core';

@Component({
	selector: 'ga-edit-candidate-rates',
	template: `
		<ga-employee-rates [isCandidate]="true"></ga-employee-rates>
	`
})
export class EditCandidateRatesComponent {}
