import { Component, OnInit } from '@angular/core';
import { TimeTrackerService } from '../time-tracker.service';
import { TimeLogType, Organization, User, IDateRange } from '@gauzy/models';
import * as moment from 'moment';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { toUTC } from 'libs/utils';
import { ToastrService } from '../../../@core/services/toastr.service';
import { Store } from '../../../@core/services/store.service';
import { NgForm } from '@angular/forms';

@Component({
	selector: 'ngx-time-tracker',
	templateUrl: './time-tracker.component.html',
	styleUrls: ['./time-tracker.component.scss']
})
export class TimeTrackerComponent implements OnInit {
	private _ngDestroy$ = new Subject<void>();
	employeesId: string;
	time: string = '00:00:00';
	current_time: string = '00:00:00';
	running: boolean;
	today: Date = new Date();
	selectedRange: IDateRange = { start: null, end: null };
	user: any = {};
	organization: Organization;

	constructor(
		private timeTrackerService: TimeTrackerService,
		private toastrService: ToastrService,
		private store: Store
	) {
		//this.updateTimePickerLimit(new Date());
		this.store.selectedOrganization$.subscribe(
			(organization: Organization) => {
				this.organization = organization;
			}
		);

		this.store.user$.subscribe((user: User) => {
			this.user = user;
		});
	}

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
		this.timeTrackerService.$dueration
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((time) => {
				this.time = moment.utc(time * 1000).format('HH:mm:ss');
			});
		this.timeTrackerService.$current_session_dueration
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((time) => {
				console.log(time);
				this.current_time = moment.utc(time * 1000).format('HH:mm:ss');
			});
		this.timeTrackerService.$running
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((isRunning) => {
				this.running = isRunning;
			});
	}

	toggle(f: NgForm) {
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

		let addRequestData = Object.assign(
			{
				startedAt,
				stoppedAt
			},
			this.timeTrackerService.timerConfig
		);

		this.timeTrackerService
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
			type == 'TRACKED' ? TimeLogType.TRACKED : TimeLogType.MANUAL;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
