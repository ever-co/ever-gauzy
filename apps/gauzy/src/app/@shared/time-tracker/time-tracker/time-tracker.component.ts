import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import {
	IOrganization,
	IUser,
	IDateRange,
	TimeLogType,
	PermissionsEnum
} from '@gauzy/contracts';
import { NgxDraggableDomMoveEvent, NgxDraggablePoint } from 'ngx-draggable-dom';
import { NbThemeService } from '@nebular/theme';
import * as moment from 'moment';
import { distinctUntilChange, toUTC } from '@gauzy/common-angular';
import { NgForm } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { faStopwatch, faPlay, faPause }  from '@fortawesome/free-solid-svg-icons';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { TimeTrackerService } from '../time-tracker.service';
import { TimesheetService } from '../../timesheet/timesheet.service';
import { ErrorHandlingService, Store, ToastrService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-web-time-tracker',
	templateUrl: './time-tracker.component.html',
	styleUrls: ['./time-tracker.component.scss']
})
export class TimeTrackerComponent implements 
	OnInit, OnDestroy {

  	play = faPlay;
  	pause = faPause;
  	stopwatch = faStopwatch;
	isDisable: boolean = false;
	isOpen: boolean = false;
  	isExpanded: boolean = true;
	futureDateAllowed: boolean = false;
	employeeId: string;
	todaySessionTime = moment().set({ hour: 0, minute: 0, second: 0 }).format('HH:mm:ss');
	currentSessionTime = moment().set({ hour: 0, minute: 0, second: 0 }).format('HH:mm:ss');
	running: boolean;
	today: Date = new Date();
	selectedRange: IDateRange = { start: null, end: null };
	user: IUser;
	organization: IOrganization;
	PermissionsEnum = PermissionsEnum;
	timeLogType = TimeLogType;

	@ViewChild(NgForm) form: NgForm;

	trackType$: Observable<string> = this.timeTrackerService.trackType$;
	theme: string;

	constructor(
		private readonly timeTrackerService: TimeTrackerService,
		private readonly timesheetService: TimesheetService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly themeService: NbThemeService,
		private readonly ngxPermissionsService: NgxPermissionsService
	) { }

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

	/**
	 * Remember timer position
	 */
	public get position() {
		return this.timeTrackerService.position;
	}
	public set position(offSet: any) {
		this.timeTrackerService.position = offSet;
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization = organization;
					this.futureDateAllowed = organization.futureDateAllowed;
				}),
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
		this.themeService
			.onThemeChange()
			.pipe(
				tap((theme) => this.theme = theme.name),
				untilDestroyed(this)
			)
			.subscribe();
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

	async addTime() {
		if (!this.organization || this.form.invalid) {
			return;
		}
		const { allowManualTime, id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		if (!(allowManualTime && await this.ngxPermissionsService.hasPermission(
			PermissionsEnum.ALLOW_MANUAL_TIME
		))) {
			return;
		}

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

	/**
	 * Draggable Web Timer Position
	 *
	 * @param event
	 */
	draggablePosition(event: NgxDraggableDomMoveEvent) {
		this.position = event.position as NgxDraggablePoint;
	}

	ngOnDestroy() { }
}
