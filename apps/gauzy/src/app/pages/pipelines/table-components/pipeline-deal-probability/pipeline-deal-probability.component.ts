import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { Deal } from '@gauzy/models';

@Component({
	selector: 'ga-pipeline-deal-probability',
	templateUrl: './pipeline-deal-probability.component.html'
})
export class PipelineDealProbabilityComponent implements ViewCell, OnInit {
	@Input()
	value: string | number;

	@Input()
    rowData: Deal;

    probability: number;

    ngOnInit() {
        this.probability = this.rowData.probability;
    }
}