import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-interview-rating',
    template: `
		<div class="rating">
			<ga-star-rating-output [rate]="rowData.rating"></ga-star-rating-output>
		</div>
	`,
    standalone: false
})
export class InterviewStarRatingComponent {
	@Input() rowData: any;
}
