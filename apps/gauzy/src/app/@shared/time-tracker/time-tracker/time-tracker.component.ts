import { Component, OnInit } from '@angular/core';
import { TimeTrackerService } from '../time-tracker.service';
import { TimeLogType, IManualTimeInput, Organization } from '@gauzy/models';
import * as moment from 'moment';
import { takeUntil, ignoreElements } from 'rxjs/operators';
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
	time: string = '00:00:00';
	running: boolean;
	today: Date = new Date();
	manualTime: any = {};

	minSlotStartTime: string;
	maxSlotStartTime: string;
	maxSlotEndTime: string;
	minSlotEndTime: string;
	organization: Organization;

	constructor(
		private timeTrackerService: TimeTrackerService,
		private toastrService: ToastrService,
		private store: Store
	) {
		this.updateTimePickerLimit(new Date());
		this.store.selectedOrganization$.subscribe(
			(organization: Organization) => {
				this.organization = organization;
			}
		);
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

	ngOnInit() {
		this.timeTrackerService.$dueration
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((time) => {
				this.time = moment.utc(time * 1000).format('HH:mm:ss');
			});
		this.timeTrackerService.$running
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((isRunning) => {
				this.running = isRunning;
			});
	}

	private resetForm() {
		this.updateTimePickerLimit(new Date());
	}

	toggle(f: NgForm) {
		if (!this.running && !f.valid) {
			return;
		}
		this.timeTrackerService.toggle();
	}

	addTime(f: NgForm) {
		if (!f.valid) {
			return;
		}
		const startedAt = toUTC(
			moment(this.manualTime.date).format('YYYY-MM-DD') +
				' ' +
				this.manualTime.startTime
		).toDate();
		const stoppedAt = toUTC(
			moment(this.manualTime.date).format('YYYY-MM-DD') +
				' ' +
				this.manualTime.endTime
		).toDate();

		let addRequestData = Object.assign({}, this.manualTime);
		delete addRequestData.date;
		delete addRequestData.startTime;
		delete addRequestData.endTime;
		addRequestData.startedAt = startedAt;
		addRequestData.stoppedAt = stoppedAt;

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
				this.resetForm();
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

	updateTimePickerLimit(date: Date) {
		let mTime = moment(date);

		if (mTime.isSame(new Date(), 'day')) {
			mTime = mTime.set({
				hour: moment().get('hour'),
				minute: moment().get('minute') - (moment().minutes() % 10),
				second: 0,
				millisecond: 0
			});

			this.manualTime = {
				description: '',
				startTime: mTime
					.clone()
					.subtract(30, 'minutes')
					.format('HH:mm'),
				endTime: mTime.format('HH:mm'),
				date: mTime.toDate()
			};
		}

		if (mTime.isSame(new Date(), 'day')) {
			this.minSlotStartTime = '00:00';
			this.maxSlotStartTime = mTime
				.clone()
				.subtract(10, 'minutes')
				.format('HH:mm');
			this.maxSlotEndTime = mTime.format('HH:mm');
		} else {
			this.minSlotStartTime = '00:00';
			this.maxSlotStartTime = '23:59';
			this.maxSlotEndTime = '23:59';
		}
		this.updateEndTimeSlot(this.manualTime.startTime);
	}

	updateEndTimeSlot(time: string) {
		this.minSlotEndTime = moment(time, 'HH:mm')
			.add(10, 'minutes')
			.format('HH:mm');
		if (
			!moment(time, 'HH:mm').isBefore(
				moment(this.manualTime.endTime, 'HH:mm')
			)
		) {
			this.manualTime.endTime = moment(this.manualTime.startTime, 'HH:mm')
				.add(30, 'minutes')
				.format('HH:mm');
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
