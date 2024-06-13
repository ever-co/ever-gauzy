import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ICandidate } from '@gauzy/contracts';

@Component({
	selector: 'ga-candidate-multi-select',
	templateUrl: './candidate-multi-select.component.html'
})
export class CandidateMultiSelectComponent {
	@Input() selectedCandidateIds: string[];
	@Input() allCandidates: ICandidate[];

	@Output() selectedChange = new EventEmitter();

	constructor() {}

	onMembersSelected(selectEvent: any): void {
		this.selectedChange.emit(selectEvent);
	}
}
