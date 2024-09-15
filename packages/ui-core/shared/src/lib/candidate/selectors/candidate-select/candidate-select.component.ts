import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { ICandidate } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
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
	public showRejected: boolean = false;
	public searchControl: FormControl = new FormControl();
	public filteredCandidates$: Observable<ICandidate[]>;
	private candidatesMap: Map<ICandidate['id'], ICandidate> = new Map();

	@Input() placeholder: string;
	@Input() disabled = false;
	@Input() public set reset(value: boolean | null) {
		if (value) {
			this.select.reset();
			this.searchControl.setValue(''); // Clear the search input as well
		}
	}
	@Output() selectedChange = new EventEmitter();
	@ViewChild('autoInput') input;

	constructor(store: Store, candidatesService: CandidatesService, errorHandlingService: ErrorHandlingService) {
		super(store, candidatesService, errorHandlingService);
	}

	override ngOnInit(): void {
		super.ngOnInit(); // Call the parent class's ngOnInit function
		this.filteredCandidates$ = this.searchControl.valueChanges.pipe(
			startWith(''),
			switchMap((term) =>
				this.candidates$.pipe(
					map((candidates) => {
						this.candidatesMap.clear(); // Clear previous candidates map
						candidates.forEach((candidate) => this.candidatesMap.set(candidate.id, candidate));
						return this.filterCandidatesList(candidates, term);
					})
				)
			)
		);
	}

	private filterCandidatesList(candidates: ICandidate[], term: string): ICandidate[] {
		const lowerTerm = term.toLowerCase();
		return candidates.filter((candidate) => candidate.user?.name.toLowerCase().includes(lowerTerm));
	}

	/**
	 *
	 * @param candidate
	 */
	onCandidateSelected(candidateId: ICandidate['id']): void {
		const selectedCandidate = this.candidatesMap.get(candidateId);
		if (selectedCandidate) {
			this.searchControl.setValue(selectedCandidate.user?.name || '');
			this.selectedChange.emit(candidateId);
		}
	}
}
