import { Component, Input, OnInit } from '@angular/core';
import { IDeal } from '@gauzy/contracts';

@Component({
    selector: 'ga-pipeline-deal-probability',
    templateUrl: './pipeline-deal-probability.component.html',
    standalone: false
})
export class PipelineDealProbabilityComponent implements OnInit {
	@Input()
	value: string | number;

	@Input()
	rowData: IDeal;

	probability: number;

	ngOnInit() {
		this.probability = this.rowData.probability;
	}
}
