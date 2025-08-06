import { Component, OnInit, Input, OnDestroy, Output } from '@angular/core';
import {
	IDateRangePicker,
	IOrganization,
	ITimeLog,
	PermissionsEnum,
	TimeLogPartialStatus,
	TimeLogSourceEnum
} from '@gauzy/contracts';
import * as moment from 'moment';
import { NbDialogService, NbPopoverDirective } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { DateRangePickerBuilderService, Store, TimeTrackerService, TimesheetService } from '@gauzy/ui-core/core';
import { EditTimeLogModalComponent } from './../edit-time-log-modal';
import { ViewTimeLogModalComponent } from './../view-time-log-modal';
import { combineLatest, Observable, Subject, takeUntil } from 'rxjs';
import { TimeZoneService } from '../gauzy-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-view-time-log',
	templateUrl: './view-time-log.component.html',
	styleUrls: ['./view-time-log.component.scss'],
	standalone: false
})
export class ViewTimeLogComponent implements OnInit, OnDestroy {
	organization: IOrganization;
	PermissionsEnum = PermissionsEnum;
	limitReached = false;
	hasPermission = false;

	@Input() timeLogs: ITimeLog[] = [];
	@Input() timeZone: string;
	@Input() callback: CallableFunction;
	@Input() date?: string;
	@Input() popover: NbPopoverDirective;

	private readonly workedThisWeek$: Observable<number> = this.timeTrackerService.workedThisWeek$;
	private readonly reWeeklyLimit$: Observable<number> = this.timeTrackerService.reWeeklyLimit$;
	private readonly destroy$ = new Subject<void>();
	private readonly selectedDateRange$: Observable<IDateRangePicker | null> =
		this.dateRangePickerBuilderService.selectedDateRange$;

	constructor(
		private readonly nbDialogService: NbDialogService,
		private readonly timesheetService: TimesheetService,
		private readonly store: Store,
		private readonly timeTrackerService: TimeTrackerService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {}

	ngOnInit(): void {
		this.hasPermission = this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();

		combineLatest([this.selectedDateRange$, this.workedThisWeek$, this.reWeeklyLimit$])
			.pipe(takeUntil(this.destroy$))
			.subscribe(([selectedDateRange]) => {
				if (this.timeTrackerService.isCurrentWeekSelected(selectedDateRange)) {
					this.limitReached = this.timeTrackerService.hasReachedWeeklyLimit();
				} else {
					this.limitReached = false;
				}
			});
	}

	openAddByDateProject($event: MouseEvent) {
		if (this.limitReached && !this.hasPermission) return;
		const [timeLog] = this.timeLogs;
		const baseDate = moment(this.date);
		const startedAt = baseDate
			.clone()
			.tz(this.timeZone)
			.set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
			.toDate();

		const stoppedAt = baseDate
			.clone()
			.tz(this.timeZone)
			.set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
			.toDate();

		this.openEdit($event, {
			startedAt,
			stoppedAt,
			projectId: timeLog.projectId,
			isRunning: timeLog.isRunning
		});
	}

	openEdit(
		$event: MouseEvent,
		timeLog: {
			startedAt: Date;
			stoppedAt: Date;
			projectId: string;
			isRunning: boolean;
		}
	) {
		if (timeLog.isRunning) {
			return;
		}
		$event.stopPropagation();
		this.nbDialogService
			.open(EditTimeLogModalComponent, { context: { timeLog: timeLog, timeZone: this.timeZone } })
			.onClose.pipe(untilDestroyed(this))
			.subscribe((data) => {
				this.callback(data);
			});
	}

	viewLog(timeLog: ITimeLog) {
		this.nbDialogService
			.open(ViewTimeLogModalComponent, {
				context: {
					timeLog: timeLog,
					timeZone: this.timeZone
				},
				dialogClass: 'view-log-dialog'
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe((res) => {
				this.callback(res);
			});
	}

	onDeleteConfirm(timeLog: ITimeLog) {
		if (timeLog.isRunning) {
			return;
		}
		const { id: organizationId } = this.organization;
		const request = {
			logs: [
				{
					id: timeLog.id,
					partialStatus: timeLog.partialStatus,
					referenceDate:
						timeLog.partialStatus === TimeLogPartialStatus.TO_LEFT ? timeLog.stoppedAt : timeLog.startedAt
				}
			],
			organizationId
		};
		this.timesheetService.deleteLogs(request).then((res) => {
			this.callback(res);
			this.checkTimerStatus();
		});
	}

	async checkTimerStatus() {
		if (!this.organization) {
			return;
		}
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const { employeeId, tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		if (employeeId) {
			await this.timeTrackerService.checkTimerStatus({
				organizationId,
				tenantId,
				source: TimeLogSourceEnum.WEB_TIMER,
				timeZone
			});
		}
	}

	onClose() {
		if (this.popover) {
			this.popover.hide();
		}
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
