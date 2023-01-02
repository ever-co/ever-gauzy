import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService, NbPopoverDirective } from '@nebular/theme';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { chain, pick } from 'underscore';
import {
	IGetTimeLogInput,
	ITimeLog,
	IOrganizationProject,
	ITimeLogFilters,
	PermissionsEnum
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
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

	PermissionsEnum = PermissionsEnum;
	filters: ITimeLogFilters = this.request;

	weekData: WeeklyDayData[] = [];
	weekDayList: string[] = [];
	loading: boolean;
	viewTimeLogComponent = ViewTimeLogComponent;

	futureDateAllowed: boolean;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;

	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);
	@ViewChild(NbPopoverDirective) popover: NbPopoverDirective;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly translateService: TranslateService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService, dateRangePickerBuilderService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.updateWeekDayList()),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getWeeklyTimesheetLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.timesheetService.updateLog$
			.pipe(
				filter((val) => val === true),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	updateWeekDayList() {
		const { startDate, endDate } = this.request;

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
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	/**
	 * Prepare Unique Request Always
	 *
	 * @returns
	 */
	prepareRequest() {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}
		const appliedFilter = pick(
			this.filters,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeLogInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
		};
		this.payloads$.next(request);
	}

	/**
	 * Get weekly timesheet logs
	 * @returns
	 */
	async getWeeklyTimesheetLogs() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		const payloads = this.payloads$.getValue();
		this.loading = true;
		this.timesheetService
			.getTimeLogs(payloads, ['project'])
			.then((logs: ITimeLog[]) => {
				this.weekData = chain(logs)
					.groupBy('projectId')
					.map((innerLogs: ITimeLog[], _projectId) => {
						const byDate = chain(innerLogs)
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
			.onClose
			.pipe(
				filter((timeLog: ITimeLog) => !!timeLog),
				tap((timeLog: ITimeLog) => this.dateRangePickerBuilderService.refreshDateRangePicker(
					moment(timeLog.startedAt)
				)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
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
						...(this.request.employeeIds
							? { employeeId: this.request.employeeIds[0] }
							: {})
					}
				}
			})
			.onClose
			.pipe(
				filter((timeLog: ITimeLog) => !!timeLog),
				tap((timeLog: ITimeLog) => this.dateRangePickerBuilderService.refreshDateRangePicker(
					moment(timeLog.startedAt)
				)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	addTimeCallback = (data: ITimeLog) => {
		if (data) {
			this.subject$.next(true);
		}
	};

	onClose = (event: boolean) => {
		if(event) this.popover.hide();
	}

	allowAdd(date: string) {
		return this.organization.futureDateAllowed
			? true
			: moment(date).isSameOrBefore(moment());
	}

	ngOnDestroy(): void {}
}
