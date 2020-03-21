import { Component, OnInit } from '@angular/core';
import { TimeTrackerService } from '../time-tracker.service';
import { TimeLogType } from '@gauzy/models';
import * as moment from 'moment';
import { takeUntil, ignoreElements } from 'rxjs/operators';
import { Subject } from 'rxjs';

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

	constructor(private timeTrackerService: TimeTrackerService) {
		this.updateTimePickerLimit(new Date());
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

	toggle() {
		this.timeTrackerService.toggle();
	}

	addTime() {
		this.timeTrackerService.addTime(this.manualTime);
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
