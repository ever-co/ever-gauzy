import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EMPTY, Observable, catchError, filter, map, of, switchMap } from 'rxjs';
import { CandidateStatusEnum, ICandidate, IOrganization, IPagination } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { CandidatesService, ErrorHandlingService, Store } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	template: ''
})
export class BaseCandidateSelectorComponent implements OnInit {
	public candidates$: Observable<ICandidate[]>; // Observable for an array of Organization candidates

	constructor(
		protected readonly _store: Store,
		protected readonly _candidatesService: CandidatesService,
		protected readonly _errorHandlingService: ErrorHandlingService
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

				return this._candidatesService
					.getAll(['user'], {
						organizationId,
						tenantId,
						isActive: true,
						isArchived: false,
						status: CandidateStatusEnum.APPLIED
					})
					.pipe(
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

	ngOnDestroy(): void {}
}
