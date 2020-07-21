import { Component, OnInit, OnDestroy } from '@angular/core';
import { TimeTrackerService } from '../time-tracker.service';
import {
	TimeLogType,
	Organization,
	User,
	IDateRange,
	OrganizationPermissionsEnum
} from '@gauzy/models';
import * as moment from 'moment';
import { toUTC } from 'libs/utils';
import { ToastrService } from '../../../@core/services/toastr.service';
import { Store } from '../../../@core/services/store.service';
import { NgForm } from '@angular/forms';
import { TimesheetService } from '../../timesheet/timesheet.service';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';

@Component({
	selector: 'ngx-time-tracker',
	templateUrl: './time-tracker.component.html',
	styleUrls: ['./time-tracker.component.scss']
})
export class TimeTrackerComponent implements OnInit, OnDestroy {
	isOpen = false;
	employeesId: string;
	time = '00:00:00';
	current_time = '00:00:00';
	running: boolean;
	today: Date = new Date();
	selectedRange: IDateRange = { start: null, end: null };
	user: any = {};
	organization: Organization;
	OrganizationPermissionsEnum = OrganizationPermissionsEnum;
	allowFutureDate: boolean;
	form: NgForm;

	constructor(
		private timeTrackerService: TimeTrackerService,
		private timesheetService: TimesheetService,
		private toastrService: ToastrService,
		private ngxPermissionsService: NgxPermissionsService,
		private store: Store
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

	public get timeType(): TimeLogType {
		return this.timeTrackerService.timerConfig.logType;
	}
	public set timeType(value: TimeLogType) {
		this.timeTrackerService.timerConfig = {
			...this.timeTrackerService.timerConfig,
			logType: value
		};
	}

	public get taskId(): string {
		return this.timeTrackerService.timerConfig.taskId;
	}
	public set taskId(value: string) {
		this.timeTrackerService.timerConfig = {
			...this.timeTrackerService.timerConfig,
			taskId: value
		};
	}

	public get projectId(): string {
		return this.timeTrackerService.timerConfig.projectId;
	}
	public set projectId(value: string) {
		this.timeTrackerService.timerConfig = {
			...this.timeTrackerService.timerConfig,
			projectId: value
		};
	}

	public get description(): string {
		return this.timeTrackerService.timerConfig.description;
	}
	public set description(value: string) {
		this.timeTrackerService.timerConfig = {
			...this.timeTrackerService.timerConfig,
			description: value
		};
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: Organization) => {
				this.organization = organization;
			});

		this.store.user$.pipe(untilDestroyed(this)).subscribe((user: User) => {
			this.user = user;
		});

		this.timeTrackerService.$dueration
			.pipe(untilDestroyed(this))
			.subscribe((time) => {
				this.time = moment.utc(time * 1000).format('HH:mm:ss');
			});

		this.timeTrackerService.$current_session_dueration
			.pipe(untilDestroyed(this))
			.subscribe((time) => {
				this.current_time = moment.utc(time * 1000).format('HH:mm:ss');
			});

		this.timeTrackerService.$running
			.pipe(untilDestroyed(this))
			.subscribe((isRunning) => {
				this.running = isRunning;
			});

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

	toggle() {
		if (!this.isOpen) {
			this.show();
		} else {
			this.hide();
		}
	}

	show() {
		this.isOpen = true;
	}

	hide() {
		this.isOpen = false;
	}

	toggleTimer(f: NgForm) {
		if (!this.running && !f.valid) {
			f.resetForm();
			return;
		}
		this.timeTrackerService.toggle();
	}

	addTime(f: NgForm) {
		if (!f.valid) {
			return;
		}
		const startedAt = toUTC(this.selectedRange.start).toDate();
		const stoppedAt = toUTC(this.selectedRange.end).toDate();

		const addRequestData = Object.assign(
			{
				startedAt,
				stoppedAt
			},
			this.timeTrackerService.timerConfig
		);

		this.timesheetService
			.addTime(addRequestData)
			.then((timeLog) => {
				if (
					moment
						.utc(timeLog.startedAt)
						.local()
						.isSame(new Date(), 'day')
				) {
					this.timeTrackerService.dueration =
						this.timeTrackerService.dueration + timeLog.duration;
				}
				f.resetForm();
				//this.updateTimePickerLimit(new Date());
				this.selectedRange = { start: null, end: null };
				this.toastrService.success('TIMER_TRACKER.ADD_TIME_SUCCESS');
			})
			.catch((error) => {
				this.toastrService.danger(error);
			});
	}

	setTimeType(type: string) {
		this.timeType =
			type === 'TRACKED' ? TimeLogType.TRACKED : TimeLogType.MANUAL;
	}

	ngOnDestroy() {}
}
