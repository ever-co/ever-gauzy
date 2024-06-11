import { AfterViewInit, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { ICountsStatistics, IGetCountsStatistics, ITimeLogFilters, PermissionsEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { pick } from 'underscore';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { Store, distinctUntilChange, isEmpty } from '@gauzy/ui-sdk/common';
import {
	DateRangePickerBuilderService,
	EmployeesService,
	OrganizationProjectsService,
	TimesheetStatisticsService
} from '@gauzy/ui-sdk/core';
import { BaseSelectorFilterComponent, TimeZoneService } from '@gauzy/ui-sdk/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-daily-statistics',
	templateUrl: './daily-statistics.component.html',
	styleUrls: ['./daily-statistics.component.scss']
})
export class DailyStatisticsComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	PermissionsEnum = PermissionsEnum;
	counts: ICountsStatistics;
	loading: boolean;
	employeesCount: number;
	projectsCount: number;

	/*
	 * Getter & Setter for dynamic filters
	 */
	private _filters: ITimeLogFilters = this.request;
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(filters: ITimeLogFilters) {
		if (filters) {
			this._filters = filters;
			this.subject$.next(true);
		}
	}

	constructor(
		private readonly timesheetStatisticsService: TimesheetStatisticsService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef,
		private readonly employeesService: EmployeesService,
		private readonly projectService: OrganizationProjectsService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getCounts()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	prepareRequest() {
		if (!this.organization || isEmpty(this.filters)) {
			return;
		}
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');
		const request: IGetCountsStatistics = {
			...appliedFilter,
			...this.getFilterRequest(this.request)
		};
		this.payloads$.next(request);
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	/**
	 * Retrieves counts from the timesheet statistics service based on current filters and organization.
	 * Loads employee and project counts if organization and filters are defined.
	 */
	async getCounts(): Promise<void> {
		try {
			// Check if organization or filters are not defined, return if so
			if (!this.organization || isEmpty(this.filters)) {
				return;
			}

			// Extract payloads from BehaviorSubject
			const payloads = this.payloads$.getValue();

			// Set loading state to true
			this.loading = true;

			// Retrieve counts from timesheet statistics service
			const counts = await this.timesheetStatisticsService.getCounts(payloads);

			// Update counts
			this.counts = counts;

			// Load employee and project counts
			await Promise.all([this.loadEmployeesCount(), this.loadProjectsCount()]);
		} catch (error) {
			// Log error if any
			console.error('Error while retrieving daily statistics', error);
		} finally {
			// Set loading state to false
			this.loading = false;
		}
	}

	/**
	 * Loads the count of employees for the organization.
	 */
	private async loadEmployeesCount() {
		// Check if the user already has an associated employee
		if (this.store.user.employee) {
			// If the user has an employee, no need to load the count
			return;
		}

		// Extract organization and tenant IDs
		const { id: organizationId, tenantId } = this.organization;

		// Retrieve the count of employees for the organization
		this.employeesService
			.getCount({ organizationId, tenantId })
			.pipe(
				// Update employees count when count is received
				tap((count: number) => (this.employeesCount = count)),
				// Unsubscribe from the observable when component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Loads the count of projects for the organization.
	 */
	private async loadProjectsCount() {
		// Extract organization and tenant IDs
		const { id: organizationId, tenantId } = this.organization;

		// Retrieve the count of projects for the organization
		this.projectsCount = await this.projectService.getCount({
			organizationId,
			tenantId
		});
	}

	public get period() {
		if (this.request && this.organization) {
			const { startDate, endDate } = this.request;
			const endWork = moment(this.organization.defaultEndTime, 'HH:mm');
			const startWork = moment(this.organization.defaultStartTime, 'HH:mm');
			const duration = endWork.diff(startWork) / 1000;
			if (startDate && endDate && this.counts) {
				const start = moment(startDate);
				const end = moment(endDate);
				const dayCount = end.diff(start, 'days') + 1;
				return dayCount * (isNaN(duration) ? 86400 : duration) * this.counts.employeesCount;
			}
		}
	}
}
