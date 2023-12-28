import { Component, Input } from '@angular/core';

@Component({
	templateUrl: './candidate-status.component.html',
	styleUrls: ['./candidate-status.component.scss']
})
export class CandidateStatusComponent {
	@Input()
	rowData: any;

	value: string | number;
}
