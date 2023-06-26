import { CurrencyPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'job-title-description-details',
	templateUrl: './job-title-description-details.component.html',
	styleUrls: ['./job-title-description-details.component.scss'],
	providers: [CurrencyPipe]
})
export class JobTitleDescriptionDetailsComponent implements ViewCell {

	@Input() rowData: any;

	value: string | number;

	/**
	 * Icon with link to Job Post
	 *
	 * @returns
	 */
	public openJob() {
		if (!this.rowData) {
			return;
		}
		if (this.rowData?.jobPost) {
			window.open(this.rowData.jobPost.url, '_blank');
		}
	}
}
