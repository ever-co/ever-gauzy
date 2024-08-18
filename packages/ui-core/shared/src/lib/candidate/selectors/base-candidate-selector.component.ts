import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, EMPTY, Observable, catchError, combineLatest, filter, map, of, switchMap } from 'rxjs';
import { CandidateStatusEnum, ICandidate, IOrganization, IPagination } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { CandidatesService, ErrorHandlingService, Store } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	template: ''
})
export class BaseCandidateSelectorComponent implements OnInit {
	public candidates$: Observable<ICandidate[]>;
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
							this._errorHandlingService.handleError(error);
							return EMPTY;
						}),
						untilDestroyed(this)
					);
			}),
			untilDestroyed(this)
		);
	}

	toggleShowRejected() {
		this.showRejected$.next(!this.showRejected$.value);
	}

	ngOnDestroy(): void {}
}
