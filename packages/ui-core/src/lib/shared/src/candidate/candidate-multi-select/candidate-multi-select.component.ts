import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { EMPTY, Observable, of } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ICandidate, IOrganization, IPagination } from '@gauzy/contracts';
import { distinctUntilChange, Store } from '@gauzy/ui-core/common';
import { CandidatesService, ErrorHandlingService } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	selector: 'ga-candidate-multi-select',
	templateUrl: './candidate-multi-select.component.html',
	styleUrls: ['./candidate-multi-select.component.scss']
})
export class CandidateMultiSelectComponent implements OnInit {
	public candidates$: Observable<ICandidate[]>; // Observable for an array of Organization candidates

	@Input() selectedCandidateIds: string[] = [];
	@Output() selectedChange = new EventEmitter();

	constructor(
		private readonly _store: Store,
		private readonly _candidatesService: CandidatesService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	ngOnInit(): void {
		this.candidates$ = this._store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization),
			distinctUntilChange(),
			switchMap((organization: IOrganization) => {
				// Extract project properties
				const { id: organizationId, tenantId } = organization;
				// Ensure there is a valid organization
				if (!organizationId) {
					return of([]); // No valid organization, return empty array of candidates
				}

				return this._candidatesService.getAll(['user'], { organizationId, tenantId }).pipe(
					map(({ items }: IPagination<ICandidate>) => items),
					catchError((error) => {
						// Handle and log errors
						this._errorHandlingService.handleError(error);
						return EMPTY;
					}),
					// Handle component lifecycle to avoid memory leaks
					untilDestroyed(this)
				);
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
	}

	/**
	 *
	 * @param candidate
	 */
	onCandidateSelected(candidate: ICandidate['id']): void {
		this.selectedChange.emit(candidate);
	}
}
