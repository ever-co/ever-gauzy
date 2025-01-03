import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, EMPTY, Observable, catchError, combineLatest, filter, map, of, switchMap } from 'rxjs';
import { CandidateStatusEnum, ICandidate, IPagination } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { CandidatesService, ErrorHandlingService, Store } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
    template: '',
    standalone: false
})
export class BaseCandidateSelectorComponent implements OnInit {
	public candidates$: Observable<ICandidate[]>; // Observable for an array of Organization candidates
	public showRejected$ = new BehaviorSubject<boolean>(false);

	constructor(
		protected readonly _store: Store,
		protected readonly _candidatesService: CandidatesService,
		protected readonly _errorHandlingService: ErrorHandlingService
	) {}

	ngOnInit(): void {
		this.candidates$ = combineLatest([this._store.selectedOrganization$, this.showRejected$]).pipe(
			filter(([organization]) => !!organization),
			distinctUntilChange(),
			switchMap(([organization, showRejected]) => {
				const { id: organizationId, tenantId } = organization;
				// Ensure there is a valid organization
				if (!organizationId) {
					return of([]);
				}

				const status = showRejected ? CandidateStatusEnum.REJECTED : CandidateStatusEnum.APPLIED;

				return this._candidatesService
					.getAll(['user'], {
						organizationId,
						tenantId,
						isActive: true,
						isArchived: false,
						status: status
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
			// Handle component lifecycle to avoid memory leak
			untilDestroyed(this)
		);
	}

	toggleShowRejected() {
		this.showRejected$.next(!this.showRejected$.value);
	}

	ngOnDestroy(): void {}
}
