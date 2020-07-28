import { Component, Input, OnInit } from '@angular/core';

@Component({
	selector: 'ga-interview-rating',
	template: `<div class="rating">
		<ga-star-rating-output [rate]="rowData.rating"></ga-star-rating-output>
	</div>`,
	styles: [``]
})
export class InterviewStarRatingComponent implements OnInit {
	@Input()
	rowData: any;
	ngOnInit() {
		if (this.rowData.feedbacks.length > 0) {
			const res: number[] = [];
			this.rowData.feedbacks.forEach((fb) => {
				res.push(Number(fb.rating));
			});

			const fbSum = res.reduce((sum, current) => {
				return sum + current;
			});
			this.rowData.rating = fbSum / this.rowData.feedbacks.length;
		} else {
			this.rowData.rating = 0;
		}
	}
}
