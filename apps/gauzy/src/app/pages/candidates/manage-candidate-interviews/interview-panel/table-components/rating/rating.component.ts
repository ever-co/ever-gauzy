import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-interview-rating',
    template: `
		<div class="rating">
			<ga-star-rating-output [rate]="rowData.rating"></ga-star-rating-output>
		</div>
	`,
    // Compact stars for a table row; the shared component sets its size inline (1.5rem)
    styles: [
        `
			:host ::ng-deep .stars {
				margin: 0;
				gap: 0.125rem;
			}
			:host ::ng-deep .rating-star-icon {
				font-size: 0.875rem !important;
				line-height: 1;
			}
		`
    ],
    standalone: false
})
export class InterviewStarRatingComponent {
	@Input() rowData: any;
}
