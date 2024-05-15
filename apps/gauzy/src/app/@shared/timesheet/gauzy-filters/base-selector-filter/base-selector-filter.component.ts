import { Component } from '@angular/core';
import { combineLatest, debounceTime } from 'rxjs';
import { Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { IOrganization, ITimeLogFilters } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { toUTC } from '@gauzy/common-angular';
import { pick } from 'underscore';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import { Store } from './../../../../@core/services';
import { getAdjustDateRangeFutureAllowed } from './../../../../@theme/components/header/selectors/date-range-picker';

@UntilDestroy({ checkProperties: true })
@Component({
	template: ''
})
export class BaseSelectorFilterComponent extends TranslationBaseComponent {
	request: ITimeLogFilters = {
		employeeIds: [],
		projectIds: [],
		teamIds: []
	};
	organization: IOrganization;
	subject$: Subject<boolean> = new Subject();

	constructor(
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(translateService);
		this.onInit();
	}

	/**
	 * Subscribes to multiple observables representing selected values, combines them, and reacts to changes.
	 * Adjusts the 'organization', 'request.employeeIds', 'request.projectIds', 'request.teamIds',
	 * and 'request' properties based on the emitted values.
	 * Emits a value to the 'subject$' subject and ensures the subscription is unsubscribed onDestroy.
	 */
	onInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		const storeProject$ = this.store.selectedProject$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeTeam$ = this.store.selectedTeam$;
		combineLatest([storeOrganization$, storeDateRange$, storeEmployee$, storeProject$, storeTeam$])
			.pipe(
				debounceTime(300),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				tap(([organization, dateRange, employee, project, team]) => {
					if (organization) {
						this.organization = organization;

						this.request.employeeIds = employee?.id ? [employee.id] : [];
						this.request.projectIds = project?.id ? [project.id] : [];
						this.request.teamIds = team?.id ? [team.id] : [];

						if (dateRange) {
							this.request = { ...this.request, ...dateRange };
						}
					}
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Transforms a given ITimeLogFilters object by adjusting date range, extracting organizationId and tenantId,
	 * and formatting dates to UTC.
	 * @param request - The original ITimeLogFilters object to be transformed.
	 * @returns The modified ITimeLogFilters object.
	 */
	getFilterRequest(request: ITimeLogFilters): ITimeLogFilters {
		// Retrieve adjusted start and end dates using getAdjustDateRangeFutureAllowed
		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(request);

		// Extract organizationId and tenantId from the organization object
		const { id: organizationId, tenantId } = this.organization;

		// Create a selectorFilters object containing projectIds, employeeIds, and teamIds
		const selectorFilters = pick(this.request, 'projectIds', 'employeeIds', 'teamIds');

		// Build the final ITimeLogFilters object
		const filterRequest: ITimeLogFilters = {
			...selectorFilters,
			organizationId,
			tenantId,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm')
		};

		// Return the modified ITimeLogFilters object
		return filterRequest;
	}
}
