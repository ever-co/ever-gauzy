import { Component } from '@angular/core';
import { combineLatest, debounceTime } from 'rxjs';
import { Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { IOrganization, ITimeLogFilters } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { pick } from 'underscore';
import { toUtcOffset } from '@gauzy/ui-sdk/common';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';
import { getAdjustDateRangeFutureAllowed } from './../../../../@theme/components/header/selectors/date-range-picker';
import { TimeZoneService } from '../timezone-filter';

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
		protected readonly translateService: TranslateService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
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

		const timeZone = this.timeZoneService.currentTimeZone;

		// Create a selectorFilters object containing projectIds, employeeIds, and teamIds
		const selectorFilters = pick(this.request, 'projectIds', 'employeeIds', 'teamIds');

		// Build the final ITimeLogFilters object
		const filterRequest: ITimeLogFilters = {
			...selectorFilters,
			organizationId,
			tenantId,
			startDate: toUtcOffset(startDate, timeZone).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUtcOffset(endDate, timeZone).format('YYYY-MM-DD HH:mm:ss'),
			// Set the 'timezone' property to the determined timezone
			timeZone
		};

		// Return the modified ITimeLogFilters object
		return filterRequest;
	}
}
