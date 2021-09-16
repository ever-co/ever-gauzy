import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TimeTrackerService } from '../time-tracker.service';
import {
	IOrganization,
	IUser,
	IDateRange,
	OrganizationPermissionsEnum,
	TimeLogType
} from '@gauzy/contracts';
import * as moment from 'moment';
import { toUTC } from '@gauzy/common-angular';
import { NgForm } from '@angular/forms';
import { TimesheetService } from '../../timesheet/timesheet.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/Observable';
import { ErrorHandlingService, Store, ToastrService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-time-tracker',
	templateUrl: './time-tracker.component.html',
	styleUrls: ['./time-tracker.component.scss']
})
export class TimeTrackerComponent implements OnInit, OnDestroy {

	isDisable: boolean = false;
	isOpen: boolean = false;
	employeeId: string;
	todaySessionTime = moment().set({ hour: 0, minute: 0, second: 0 }).format('HH:mm:ss');
	currentSessionTime = moment().set({ hour: 0, minute: 0, second: 0 }).format('HH:mm:ss');
	running: boolean;
	today: Date = new Date();
	selectedRange: IDateRange = { start: null, end: null };
	user: IUser;
	organization: IOrganization;
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	timeLogType = TimeLogType;
	allowFutureDate: boolean;

	@ViewChild(NgForm) form: NgForm;

	trackType$: Observable<string> = this.timeTrackerService.trackType$;

	constructor(
		private readonly timeTrackerService: TimeTrackerService,
		private readonly timesheetService: TimesheetService,
		private readonly toastrService: ToastrService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly store: Store,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	public get isBillable(): boolean {
		return this.timeTrackerService.timerConfig.isBillable;
	}
	public set isBillable(value: boolean) {
		this.timeTrackerService.timerConfig = {
			...this.timeTrackerService.timerConfig,
			isBillable: value
		};
	}

	public get taskId(): string {
		const { taskId } = this.timeTrackerService.timerConfig;
		if (taskId) {
			return taskId;
		}
		return null;
	}
	public set taskId(value: string) {
		this.timeTrackerService.timerConfig = {
			...this.timeTrackerService.timerConfig,
			taskId: value
		};
	}

	public get organizationContactId(): string {
		const { organizationContactId } = this.timeTrackerService.timerConfig;
		if (organizationContactId) {
			return organizationContactId;
		}
		return null;
	}
	public set organizationContactId(value: string) {
		this.timeTrackerService.timerConfig = {
			...this.timeTrackerService.timerConfig,
			organizationContactId: value
		};
	}

	public get projectId(): string {
		const { projectId } = this.timeTrackerService.timerConfig;
		if (projectId) {
			return projectId;
		}
		return null;
	}
	public set projectId(value: string) {
		this.timeTrackerService.timerConfig = {
			...this.timeTrackerService.timerConfig,
			projectId: value
		};
	}

	public get description(): string {
		const { description } = this.timeTrackerService.timerConfig;
		if (description) {
			return description;
		}
		return null;
	}
	public set description(value: string) {
		this.timeTrackerService.timerConfig = {
			...this.timeTrackerService.timerConfig,
			description: value
		};
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => this.user = user),
				tap((user: IUser) => this.employeeId = user.employeeId),
				untilDestroyed(this)
			)
			.subscribe();
		this.timeTrackerService.duration$
			.pipe(
				tap((time) => this.todaySessionTime = moment.utc(time * 1000).format('HH:mm:ss')),
				untilDestroyed(this)
			)
			.subscribe();
		this.timeTrackerService.showTimerWindow$
			.pipe(
				tap((isOpen) => this.isOpen = isOpen),
				untilDestroyed(this)
			)
			.subscribe();
		this.timeTrackerService.currentSessionDuration$
			.pipe(
				tap((time) => this.currentSessionTime = moment.utc(time * 1000).format('HH:mm:ss')),
				untilDestroyed(this)
			)
			.subscribe();
		this.timeTrackerService.$running
			.pipe(
				tap((isRunning) => this.running = isRunning),
				untilDestroyed(this)
			)
			.subscribe();
		this.ngxPermissionsService.permissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.ngxPermissionsService
					.hasPermission(
						OrganizationPermissionsEnum.ALLOW_FUTURE_DATE
					)
					.then((hasPermission) => {
						this.allowFutureDate = hasPermission;
					});
			});
	}

	toggleWindow() {
		if (!this.isOpen) {
			this.show();
		} else {
			this.hide();
		}
	}

	show() {
		this.timeTrackerService.showTimerWindow = true;
	}

	hide() {
		this.timeTrackerService.showTimerWindow = false;
	}

	async toggleTimer() {
		if (!this.running && this.form.invalid) {
			this.form.resetForm();
			return;
		}

		this.isDisable = true;
		await this.timeTrackerService.toggle()
			.catch((error) => {
				if (this.timeTrackerService.interval) {
					this.timeTrackerService.turnOffTimer();
				} else {
					this.timeTrackerService.turnOnTimer();
				}
				this._errorHandlingService.handleError(error);
			})
			.finally(() => {
				this.isDisable = false;
			});
	}

	addTime() {
		if (this.form.invalid) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const startedAt = toUTC(this.selectedRange.start).toDate();
		const stoppedAt = toUTC(this.selectedRange.end).toDate();
		const payload = Object.assign(
			{
				startedAt,
				stoppedAt,
				organizationId,
				tenantId
			},
			this.timeTrackerService.timerConfig
		);
		
		this.timesheetService
			.addTime(payload)
			.then((timeLog) => {
				this.timesheetService.updateLogs(true);
				this.timeTrackerService.checkTimerStatus(tenantId);
				if (
					moment
						.utc(timeLog.startedAt)
						.local()
						.isSame(new Date(), 'day')
				) {
					this.timeTrackerService.duration =
						this.timeTrackerService.duration + timeLog.duration;
				}

				this.form.resetForm();
				this.selectedRange = { start: null, end: null };

				this.toastrService.success('TIMER_TRACKER.ADD_TIME_SUCCESS');
			})
			.catch((error) => {
				this.toastrService.danger(error);
			});
	}

	setTimeType(type: string) {
		this.timeTrackerService.setTimeLogType(type);
	}

	ngOnDestroy() {}
}
