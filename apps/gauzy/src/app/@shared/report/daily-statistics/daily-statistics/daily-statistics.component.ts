import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import {
	ICountsStatistics,
	IGetCountsStatistics,
	ITimeLogFilters,
	PermissionsEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { pick } from 'underscore';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import { EmployeesService, OrganizationProjectsService, Store } from './../../../../@core/services';
import { TimesheetStatisticsService } from '../../../timesheet/timesheet-statistics.service';
import { BaseSelectorFilterComponent } from '../../../timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-daily-statistics',
	templateUrl: './daily-statistics.component.html',
	styleUrls: ['./daily-statistics.component.scss']
})
export class DailyStatisticsComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit {

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
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef,
		private readonly employeesService: EmployeesService,
		private readonly projectService: OrganizationProjectsService
	) {
		super(store, translateService);
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
		const appliedFilter = pick(
			this.filters,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetCountsStatistics = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
		};
		this.payloads$.next(request);
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	async getCounts() {
		if (!this.organization || isEmpty(this.filters)) {
			return;
		}
		const payloads = this.payloads$.getValue();

		this.loading = true;
		try {
			const counts = await this.timesheetStatisticsService.getCounts(payloads);
			this.counts = counts;

			this.loadEmployeesCount();
			this.loadProjectsCount();
		} catch (error) {
			console.log('Error while retrieving daily statistics', error);
		} finally {
			this.loading = false;
		}
	}

	private async loadEmployeesCount() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.employeesCount = await this.employeesService.getCount([], {
			organizationId,
			tenantId
		});
	}

	private async loadProjectsCount() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.projectsCount = await this.projectService.getCount([], {
			organizationId,
			tenantId
		});
	}

	get period() {
		if (this.request) {
			const { startDate, endDate } = this.request;
			const start = moment(startDate);
			const end = moment(endDate);
			return end.diff(start, 'days') * 86400;
		}
	}
}
