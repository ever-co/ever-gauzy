import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ICandidate } from '@gauzy/contracts';
import { FormControl } from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import { BaseCandidateSelectorComponent } from '../base-candidate-selector.component';

@UntilDestroy()
@Component({
	selector: 'ga-candidate-select',
	templateUrl: './candidate-select.component.html',
	styleUrls: ['../base-candidate-selector.component.scss']
})
export class CandidateSelectComponent extends BaseCandidateSelectorComponent implements OnInit {
	public select: FormControl = new FormControl();

	@Input() selectedCandidateId: string;
	@Input() placeholder: string;
	@Input() disabledIds: string[];
	@Input() allCandidates: ICandidate[];
	@Input() isAllMembers = false;
	@Input() disabled = false;
	@Input() isPlaceholderSelected = false;
	@Input() public set reset(value: boolean | null) {
		if (value) {
			this.select.reset();
		}
	}
	@Output() selectedChange = new EventEmitter();

	override ngOnInit(): void {
		super.ngOnInit(); // Call the parent class's ngOnInit function
	}

	/**
	 *
	 * @param candidate
	 */
	onCandidateSelected(candidate: ICandidate['id']): void {
		this.selectedChange.emit(candidate);
	}
}
