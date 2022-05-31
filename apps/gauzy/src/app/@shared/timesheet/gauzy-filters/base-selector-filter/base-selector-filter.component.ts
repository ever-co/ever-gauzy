import { Component } from '@angular/core';
import { combineLatest, debounceTime } from 'rxjs';
import { Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { IOrganization, ITimeLogFilters } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange, toUTC } from '@gauzy/common-angular';
import { pick } from 'underscore';
import { Store } from './../../../../@core/services';
import { TranslationBaseComponent } from './../../../language-base/translation-base.component';
import { getAdjustDateRangeFutureAllowed } from './../../../../@theme/components/header/selectors/date-range-picker';

@UntilDestroy({ checkProperties: true })
@Component({
	template: ''
})
export class BaseSelectorFilterComponent extends TranslationBaseComponent {
	request: ITimeLogFilters = {
		employeeIds: [],
		projectIds: []
	};
	organization: IOrganization;
	subject$: Subject<boolean> = new Subject();

	constructor(
		protected readonly store: Store,
		public readonly translateService: TranslateService
	) {
		super(translateService);
		this.onInit();
	}

	onInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.store.selectedDateRange$;
		const storeProject$ = this.store.selectedProject$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeDateRange$, storeEmployee$, storeProject$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				tap(([organization]) => (this.organization = organization)),
				tap(([organization, dateRange, employee, project]) => {
					if (employee && employee.id) {
						this.request.employeeIds = [employee.id];
					} else {
						delete this.request.employeeIds;
					}
					if (project && project.id) {
						this.request.projectIds = [project.id];
					} else {
						delete this.request.projectIds;
					}
					if (dateRange) {
						this.request = {
							...this.request,
							...dateRange
						}
					}
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getFilterRequest(request: ITimeLogFilters): ITimeLogFilters {
		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(request);
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const selectorFilters = pick(this.request, 'projectIds', 'employeeIds');

		const filterRequest: ITimeLogFilters = {
			...selectorFilters,
			organizationId,
			tenantId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm')
		};
		return filterRequest;
	}
}
