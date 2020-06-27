import { Component } from '@angular/core';

@Component({
	selector: 'ga-interview-criterions',
	template: `
		<h5 id="criterions">
			{{ 'CANDIDATES_PAGE.CRITERIONS.CANDIDATE_CRITERIONS' | translate }}
		</h5>
		<div class="add-criterion">
			<ga-candidate-technologies
				class="add-criterion-card"
			></ga-candidate-technologies>
			<ga-candidate-personal-qualities
				class="add-criterion-card"
			></ga-candidate-personal-qualities>
		</div>
	`,
	styleUrls: ['./interview-criterions.component.scss']
})
export class InterviewCriterionsComponent {
	constructor() {}
}
