import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Candidate } from '@gauzy/models';
import { FormControl } from '@angular/forms';

@Component({
	selector: 'ga-candidate-select',
	templateUrl: './candidate-select.component.html'
})
export class CandidateSelectComponent {
	@Input() selectedCandidateId: string;
	@Input() placeholder: string;
	@Input() disabledIds: string[];
	@Input() allCandidates: Candidate[];
	@Input() isAllMembers = false;
	@Input() disabled = false;
	@Input() isPlaceholderSelected = false;
	@Output() selectedChange = new EventEmitter();
	select: FormControl = new FormControl();

	@Input()
	public set reset(value: boolean | null) {
		if (value) {
			this.select.reset();
		}
	}
	constructor() {}

	onMembersSelected(selectEvent: any): void {
		this.selectedChange.emit(selectEvent);
	}
}
