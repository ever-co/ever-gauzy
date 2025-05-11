import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ICandidate } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { CandidatesService, ErrorHandlingService } from '@gauzy/ui-core/core';
import { BaseCandidateSelectorComponent } from '../base-candidate-selector.component';

@Component({
    selector: 'ga-candidate-multi-select',
    templateUrl: './candidate-multi-select.component.html',
    styleUrls: ['../base-candidate-selector.component.scss'],
    standalone: false
})
export class CandidateMultiSelectComponent extends BaseCandidateSelectorComponent implements OnInit {
	@Input() selectedCandidateIds: string[] = [];
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
