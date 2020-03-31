import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	templateUrl: './candidate-status.component.html',
	styleUrls: ['./candidate-status.component.scss']
})
export class CandidateStatusComponent implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
