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
import { filter, firstValueFrom, Subject } from 'rxjs';
import { distinctUntilChanged, map, skip, tap } from 'rxjs/operators';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { EmployeesService, Store, TimesheetService, ToastrService } from '@gauzy/ui-core/core';
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
	providers: [EmployeesService],
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

	/** Numbers each read of the logs, so only the latest one's answer is shown. */
	private logsFetchId = 0;
	/** The employee lookup in flight, shared by every caller asking for the same employee. */
	private employeeLookup: { employeeId: string; request: Promise<void> } | null = null;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly activatedRoute: ActivatedRoute,
		private readonly nbDialogService: NbDialogService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly employeesService: EmployeesService,
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
		// The permissions can land after the logs are read (they are loaded
		// without being awaited at start-up), and the employee lookup needs one
		// of them: when it arrives, look the employee up then. Its value when the
		// page opens is skipped, as the read of the logs looks it up itself.
		this.store.userRolePermissions$
			.pipe(
				map(() => this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)),
				distinctUntilChanged(),
				skip(1),
				filter(Boolean),
				tap(() => this.loadEmployeeIfMissing()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** An approved timesheet's logs can no longer be edited or deleted. */
	get isLocked(): boolean {
		return this.timesheet?.status === TimesheetStatus.APPROVED;
	}

	/**
	 * Reads the timesheet's logs. An edit or a delete starts a new read while
	 * the rows stay usable, so a read still in flight when a newer one starts
	 * is dropped when it answers: an older answer arriving last cannot put back
	 * days and totals the newer one has replaced.
	 */
	async getLogs() {
		if (!this.timesheet) {
			return;
		}
		const fetchId = ++this.logsFetchId;
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
			if (fetchId !== this.logsFetchId) {
				return;
			}
			this.setLogs(logs);
			await this.loadEmployeeIfMissing();
		} catch (error) {
			console.error('Error while retrieving logs', error);
		} finally {
			if (fetchId === this.logsFetchId) {
				this.loading = false;
			}
		}
	}

	/**
	 * The employee is read off the logs, as the timesheet is fetched without it,
	 * so a timesheet with no logs had none to show. It is then read on its own,
	 * for users who may see other employees: the only ones the summary shows it to.
	 *
	 * The read of the logs and the arrival of the permission can both ask while
	 * the employee is unknown, so a lookup already in flight for the same
	 * employee is shared rather than sent twice. The page is reused when another
	 * timesheet is opened, so an answer is applied only while its employee is
	 * still the open timesheet's and the summary still has none.
	 */
	private loadEmployeeIfMissing(): Promise<void> {
		const employeeId = this.timesheet?.employeeId;
		if (this.employee || !employeeId || !this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return Promise.resolve();
		}
		if (this.employeeLookup?.employeeId === employeeId) {
			return this.employeeLookup.request;
		}
		const request = (async () => {
			try {
				const employee = await firstValueFrom(this.employeesService.getEmployeeById(employeeId, ['user']));
				if (this.timesheet?.employeeId === employeeId && !this.employee) {
					this.employee = employee;
				}
			} catch (error) {
				console.error('Error while retrieving the timesheet employee', error);
			} finally {
				if (this.employeeLookup?.employeeId === employeeId) {
					this.employeeLookup = null;
				}
			}
		})();
		this.employeeLookup = { employeeId, request };
		return request;
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
			// The route reuses this page for the next timesheet opened: an answer that lands after it moved on is
			// about another timesheet than the one on screen, which keeps its own id and status, and gets no
			// "approved" / "denied" notice that would read as its own. A failure is still reported below.
			if (this.timesheet?.id !== id) {
				return;
			}
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
