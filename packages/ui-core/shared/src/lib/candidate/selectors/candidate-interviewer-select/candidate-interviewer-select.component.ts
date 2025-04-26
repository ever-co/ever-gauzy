import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import { ICandidate, IEmployee } from '@gauzy/contracts';

@UntilDestroy()
@Component({
    selector: 'ga-candidate-interviewer-select',
    templateUrl: './candidate-interviewer-select.component.html',
    styleUrls: ['../base-candidate-selector.component.scss'],
    standalone: false
})
export class CandidateInterviewerSelectComponent {
	public select: FormControl = new FormControl();

	@Input() placeholder: string;
	@Input() disabledIds: string[];
	@Input() interviewers: IEmployee[] = [];
	@Input() isAllMembers = false;
	@Input() disabled = false;
	@Input() isPlaceholderSelected = false;
	@Input() public set reset(value: boolean | null) {
		if (value) {
			this.select.reset();
		}
	}
	@Output() selectedChange = new EventEmitter();

	/**
	 *
	 * @param candidate
	 */
	onInterviewerSelected(candidate: ICandidate['id']): void {
		this.selectedChange.emit(candidate);
	}
}
