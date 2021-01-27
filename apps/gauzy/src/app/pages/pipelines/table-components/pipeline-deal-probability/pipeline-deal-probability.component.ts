import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { IDeal } from '@gauzy/contracts';

@Component({
	selector: 'ga-pipeline-deal-probability',
	templateUrl: './pipeline-deal-probability.component.html'
})
export class PipelineDealProbabilityComponent implements ViewCell, OnInit {
	@Input()
	value: string | number;

	@Input()
	rowData: IDeal;

	probability: number;

	ngOnInit() {
		this.probability = this.rowData.probability;
	}
}
