import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'job-title-description-details',
	templateUrl: './job-title-description-details.component.html',
	styleUrls: ['./job-title-description-details.component.scss']
})
export class JobTitleDescriptionDetailsComponent implements ViewCell {

	@Input() rowData: any;

	value: string | number;
}
