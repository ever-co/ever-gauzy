import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { IDeal } from '@gauzy/contracts';
import { dealProbabilityBadge, IDealProbabilityBadge } from './deal-probability';

@Component({
	selector: 'ga-pipeline-deal-probability',
	templateUrl: './pipeline-deal-probability.component.html',
	styleUrls: ['./pipeline-deal-probability.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class PipelineDealProbabilityComponent implements OnInit {
	@Input() value: string | number;

	@Input() rowData: IDeal;

	probability: number;

	/** The chip's class and label, as the deals board draws them too. */
	badge: IDealProbabilityBadge;

	ngOnInit() {
		this.probability = this.rowData.probability;
		this.badge = dealProbabilityBadge(this.probability);
	}
}
