import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ga-interview-criterions',
    template: `
		<div class="add-criterion">
			<ga-candidate-technologies
				class="add-criterion-card"
			></ga-candidate-technologies>
			<ga-candidate-personal-qualities
				class="add-criterion-card"
			></ga-candidate-personal-qualities>
		</div>
	`,
    styleUrls: ['./interview-criterions.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class InterviewCriterionsComponent {
	constructor() {}
}
