import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import { ICandidate } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/common';
import { CandidatesService, ErrorHandlingService } from '@gauzy/ui-core/core';
import { BaseCandidateSelectorComponent } from '../base-candidate-selector.component';

@UntilDestroy()
@Component({
	selector: 'ga-candidate-select',
	templateUrl: './candidate-select.component.html',
	styleUrls: ['../base-candidate-selector.component.scss']
})
export class CandidateSelectComponent extends BaseCandidateSelectorComponent implements OnInit {
	public select: FormControl = new FormControl();
	@Input() placeholder: string;
	@Input() disabled = false;
	@Input() public set reset(value: boolean | null) {
		if (value) {
			this.select.reset();
		}
	}
	@Output() selectedChange = new EventEmitter();

	constructor(store: Store, candidatesService: CandidatesService, errorHandlingService: ErrorHandlingService) {
		super(store, candidatesService, errorHandlingService);
	}

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
