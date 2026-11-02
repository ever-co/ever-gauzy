// tslint:disable: nx-enforce-module-boundaries
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IEmployee,
	IGetTimeLogInput,
	ITimeLog,
	ITimesheet,
	IUpdateTimesheetStatusInput,
	TimesheetStatus,
	PermissionsEnum
} from '@gauzy/contracts';
import { chain } from 'underscore';
import * as moment from 'moment';
import { filter, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store, TimesheetService, ToastrService } from '@gauzy/ui-core/core';
import { EditTimeLogModalComponent } from '@gauzy/ui-core/shared';

/** One day of the timesheet: its logs, earliest first, and the time they add up to. */
interface ITimesheetDay {
	date: Date;
	logs: ITimeLog[];
	duration: number;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-timesheet-view',
	templateUrl: './view.component.html',
	styleUrls: ['./view.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TimesheetViewComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	PermissionsEnum = PermissionsEnum;
	TimesheetStatus = TimesheetStatus;
	logs$: Subject<any> = new Subject();
	timesheet: ITimesheet;

	/** The timesheet's logs by day, earliest day first. */
	days: ITimesheetDay[] = [];
	/** Time logged across the whole timesheet, in seconds. */
	totalDuration = 0;
	logCount = 0;
	projectCount = 0;
	/** A timesheet is one employee's: read off its logs, as the timesheet comes without it. */
	employee: IEmployee;

	loading = false;
	/** True while an Approve or Deny is being saved. */
	updatingStatus = false;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly activatedRoute: ActivatedRoute,
		private readonly nbDialogService: NbDialogService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.logs$
			.pipe(
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
		this.activatedRoute.data
			.pipe(
				tap((data) => !!data && !!data.timesheet),
				tap(({ timesheet }) => (this.timesheet = timesheet)),
				tap(() => this.logs$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** An approved timesheet's logs can no longer be edited or deleted. */
	get isLocked(): boolean {
		return this.timesheet?.status === TimesheetStatus.APPROVED;
	}

	async getLogs() {
		if (!this.timesheet) {
			return;
		}
		this.loading = true;
		try {
			const { organizationId, id: timesheetId } = this.timesheet;
			const request: IGetTimeLogInput = {
				timesheetId,
				organizationId
			};
			const logs: ITimeLog[] = await this.timesheetService.getTimeLogs(request, [
				'project',
				'task',
				'employee.user'
			]);
			this.setLogs(logs);
		} catch (error) {
			console.error('Error while retrieving logs', error);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Approves or denies the timesheet, then shows its new status.
	 *
	 * @param status APPROVED or DENIED
	 */
	async updateStatus(status: TimesheetStatus) {
		if (!this.timesheet || this.updatingStatus) {
			return;
		}
		const { id, organizationId } = this.timesheet;
		const request: IUpdateTimesheetStatusInput = {
			ids: [id],
			status,
			organizationId,
			tenantId: this.store.user?.tenantId
		};
		this.updatingStatus = true;
		try {
			const updated = await this.timesheetService.updateStatus(request);
			const timesheet = (updated || []).find((item: ITimesheet) => item.id === id);
			this.timesheet = { ...this.timesheet, ...(timesheet || { status }) };
			this.toastrService.success(
				status === TimesheetStatus.APPROVED ? 'TIMESHEET.APPROVE_SUCCESS' : 'TIMESHEET.DENIED_SUCCESS'
			);
		} catch (error) {
			this.toastrService.danger(error);
		} finally {
			this.updatingStatus = false;
		}
	}

	openEditDialog(timeLog: ITimeLog) {
		if (timeLog.isRunning) {
			return;
		}
		this.nbDialogService
			.open(EditTimeLogModalComponent, {
				context: { timeLog: timeLog }
			})
			.onClose.pipe(
				filter((data) => !!data),
				tap(() => this.logs$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async deleteTimeLog(timeLog: ITimeLog) {
		if (timeLog.isRunning) {
			return;
		}
		try {
			const request = {
				logIds: [timeLog.id],
				organizationId: timeLog.organizationId
			};
			await this.timesheetService.deleteLogs(request);
			this.logs$.next(true);
		} catch (error) {
			console.error('Error while deleting TimeLog', error);
		}
	}

	/**
	 * Groups the logs by the local day they started on and totals the time on
	 * each day and on the whole timesheet.
	 *
	 * @param logs The timesheet's logs
	 */
	private setLogs(logs: ITimeLog[]) {
		const sorted = [...(logs || [])].sort((a, b) => moment(a.startedAt).diff(moment(b.startedAt)));

		this.days = chain(sorted)
			.groupBy((log: ITimeLog) => moment(log.startedAt).format('YYYY-MM-DD'))
			.map((dayLogs: ITimeLog[], day: string) => ({
				// Built from local parts: the date pipe would read a bare
				// `YYYY-MM-DD` as UTC midnight, the day before west of Greenwich.
				date: moment(day, 'YYYY-MM-DD').toDate(),
				logs: dayLogs,
				duration: this.sumDuration(dayLogs)
			}))
			.value();

		this.totalDuration = this.sumDuration(sorted);
		this.logCount = sorted.length;
		this.projectCount = new Set(sorted.map((log) => log.projectId).filter(Boolean)).size;
		this.employee = sorted.find((log) => !!log.employee)?.employee ?? this.timesheet?.employee;
	}

	private sumDuration(logs: ITimeLog[]): number {
		return logs.reduce((total: number, log: ITimeLog) => total + (log.duration || 0), 0);
	}

	ngOnDestroy() {}
}
