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
import { debounceTime, tap } from 'rxjs/operators';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
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

	PermissionsEnum = PermissionsEnum;
	logRequest: ITimeLogFilters = this.request;
	counts: ICountsStatistics;
	loading: boolean;
	employeesCount: number;
	projectsCount: number;

	@Input()
	set filters(value: ITimeLogFilters) {
		if (value) {
			this.logRequest = value;
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
				debounceTime(500),
				tap(() => this.getCounts()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	async getCounts() {
		if (!this.organization || !this.logRequest) {
			return;
		}
		this.loading = true;
		const appliedFilter = pick(
			this.logRequest,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetCountsStatistics = {
			...appliedFilter,
			...this.getFilterRequest(this.logRequest),
		};
		try {
			const counts = await this.timesheetStatisticsService.getCounts(request);
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
		if(this.logRequest){
			const { startDate, endDate } = this.logRequest;
			const start = moment(startDate);
			const end = moment(endDate);
			return end.diff(start, 'days') * 86400;
		}
	}
}
