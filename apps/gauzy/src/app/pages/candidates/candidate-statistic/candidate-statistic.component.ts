import { ICandidate, ICandidateInterview, IEmployee, IOrganization, IPagination } from '@gauzy/contracts';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	CandidateInterviewService,
	CandidatesService,
	EmployeesService,
	ErrorHandlingService
} from '@gauzy/ui-core/core';
import { Store, distinctUntilChange } from '@gauzy/ui-core/common';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-candidate-statistic',
	templateUrl: './candidate-statistic.component.html',
	styleUrls: ['./candidate-statistic.component.scss']
})
export class CandidateStatisticComponent implements OnInit, OnDestroy {
	public organization$: Observable<IOrganization>;
	public candidates$: Observable<ICandidate[]>;
	public employees$: Observable<IEmployee[]>;
	public interviews$: Observable<ICandidateInterview[]>;

	constructor(
		private readonly _candidatesService: CandidatesService,
		private readonly _candidateInterviewService: CandidateInterviewService,
		private readonly _employeesService: EmployeesService,
		private readonly _store: Store,
		protected readonly _errorHandlingService: ErrorHandlingService
	) {}

	ngOnInit() {
		this.organization$ = this._store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization),
			distinctUntilChange()
		);

		this.candidates$ = this.getData$((organizationId, tenantId) =>
			this._candidatesService.getAll(['user', 'interview', 'feedbacks'], { organizationId, tenantId })
		);

		this.employees$ = this.getData$((organizationId, tenantId) =>
			this._employeesService.getAll(['user'], { organizationId, tenantId })
		);

		this.interviews$ = this.getData$((organizationId, tenantId) =>
			this._candidateInterviewService.getAll(['feedbacks', 'interviewers', 'technologies', 'personalQualities'], {
				organizationId,
				tenantId
			})
		);
	}

	/**
	 * Generic method to fetch data based on organization and tenant IDs.
	 *
	 * @param serviceMethod A function that takes organizationId and tenantId, and returns an Observable of IPagination.
	 * @returns An Observable of the items array of type T.
	 */
	private getData$<T>(
		serviceMethod: (organizationId: string, tenantId: string) => Observable<IPagination<T>>
	): Observable<T[]> {
		return this.organization$.pipe(
			switchMap((organization: IOrganization) => {
				const { id: organizationId, tenantId } = organization;
				if (!organizationId) {
					return of([]);
				}

				return serviceMethod(organizationId, tenantId).pipe(
					map(({ items }: IPagination<T>) => items),
					catchError((error) => {
						this._errorHandlingService.handleError(error);
						return of([]);
					}),
					untilDestroyed(this)
				);
			}),
			untilDestroyed(this)
		);
	}

	ngOnDestroy() {}
}
