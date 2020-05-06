import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Candidate } from '@gauzy/models';

@Component({
	selector: 'ga-candidate-multi-select',
	templateUrl: './candidate-multi-select.component.html'
})
export class CandidateMultiSelectComponent {
	@Input() selectedCandidateIds: string[];
	@Input() allCandidates: Candidate[];

	@Output() selectedChange = new EventEmitter();

	constructor() {}

	onMembersSelected(selectEvent: any): void {
		this.selectedChange.emit(selectEvent);
	}
}
