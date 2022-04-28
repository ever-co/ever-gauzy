import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import * as _ from 'underscore';
import {
	IGetTimeLogInput,
	ITimeLog,
	IOrganizationProject,
	ITimeLogFilters,
	OrganizationPermissionsEnum
} from '@gauzy/contracts';
import { isEmpty } from '@gauzy/common-angular';
import { TranslateService } from '@ngx-translate/core';
import { moment } from './../../../../../@core/moment-extend';
import { DateRangePickerBuilderService, Store } from './../../../../../@core/services';
import { TimesheetService, TimesheetFilterService } from './../../../../../@shared/timesheet';
import { EditTimeLogModalComponent, ViewTimeLogComponent } from './../../../../../@shared/timesheet';
import { BaseSelectorFilterComponent } from './../../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { GauzyFiltersComponent } from './../../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

interface WeeklyDayData {
	project?: IOrganizationProject;
	dates: any;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-weekly-timesheet',
	templateUrl: './weekly.component.html',
	styleUrls: ['./weekly.component.scss']
})
export class WeeklyComponent extends BaseSelectorFilterComponent 
	implements OnInit, OnDestroy {

	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	logRequest: ITimeLogFilters = this.request;

	weekData: WeeklyDayData[] = [];
	weekDayList: string[] = [];
	loading: boolean;
	viewTimeLogComponent = ViewTimeLogComponent;

	futureDateAllowed: boolean;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this._dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly translateService: TranslateService,
		protected readonly store: Store,
		public readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(800),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.timesheetService.updateLog$
			.pipe(
				filter((val) => val === true),
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	updateWeekDayList() {
		const { startDate, endDate } = this.logRequest;

		const start = moment(moment(startDate).format('YYYY-MM-DD'));
		const end = moment(moment(endDate).format('YYYY-MM-DD'));
		const range = Array.from(moment.range(start, end).by('day'));

		const days: Array<string> = new Array();
		let i = 0;
		while (i < range.length) {
			const date = range[i].format('YYYY-MM-DD');
			days.push(date);
			i++;
		}
		this.weekDayList = days;
	}

	filtersChange(filters: ITimeLogFilters) {
		this.logRequest = filters;
		this.updateWeekDayList();
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.subject$.next(true);
	}

	async getLogs() {
		if (!this.organization || isEmpty(this.logRequest)) {
			return;
		}
		const appliedFilter = _.pick(
			this.logRequest,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeLogInput = {
			...appliedFilter,
			...this.getFilterRequest(this.logRequest),
		};

		this.loading = true;
		this.timesheetService
			.getTimeLogs(request)
			.then((logs: ITimeLog[]) => {
				this.weekData = _.chain(logs)
					.groupBy('projectId')
					.map((innerLogs: ITimeLog[], _projectId) => {
						const byDate = _.chain(innerLogs)
							.groupBy((log) =>
								moment(log.startedAt).format('YYYY-MM-DD')
							)
							.mapObject((res: ITimeLog[]) => {
								const sum = res.reduce(
									(iteratee: any, log: any) => {
										return iteratee + log.duration;
									},
									0
								);
								return { sum, logs: res };
							})
							.value();

						const project =
							innerLogs.length > 0 ? innerLogs[0].project : null;
						const dates: any = {};
						this.weekDayList.forEach((date) => {
							dates[date] = byDate[date] || 0;
						});
						return { project, dates };
					})
					.value();
			})
			.finally(() => (this.loading = false));
	}

	openAddEdit(timeLog?: ITimeLog) {
		this.nbDialogService
			.open(EditTimeLogModalComponent, { context: { timeLog } })
			.onClose.pipe(untilDestroyed(this))
			.subscribe((data) => {
				if (data) {
					this.subject$.next(true);
				}
			});
	}

	openAddByDateProject(date, project: IOrganizationProject) {
		const minutes = moment().minutes();
		const stoppedAt = new Date(
			moment(date).format('YYYY-MM-DD') +
				' ' +
				moment()
					.set('minutes', minutes - (minutes % 10))
					.format('HH:mm')
		);
		const startedAt = moment(stoppedAt).subtract('1', 'hour').toDate();

		this.nbDialogService
			.open(EditTimeLogModalComponent, {
				context: {
					timeLog: {
						startedAt,
						stoppedAt,
						organizationContactId: project
							? project.organizationContactId
							: null,
						projectId: project ? project.id : null,
						...(this.logRequest.employeeIds
							? { employeeId: this.logRequest.employeeIds[0] }
							: {})
					}
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((data) => {
				if (data) {
					this.subject$.next(true);
				}
			});
	}

	addTimeCallback = (data: ITimeLog) => {
		if (data) {
			this.subject$.next(true);
		}
	};

	allowAdd(date: string) {
		return this.organization.futureDateAllowed
			? true
			: moment(date).isSameOrBefore(moment());
	}
	
	ngOnDestroy(): void {}
}
