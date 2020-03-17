import { Component, OnInit } from '@angular/core';
import { TimeTrackerService } from './time-tracker.service';
import { TimeLog, TimeLogType } from '@gauzy/models';
import * as moment from 'moment';
import { takeUntil } from 'rxjs/operators';
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
	timeType: TimeLogType = TimeLogType.TRACKED;
	isBillable: boolean = true;

	constructor(private timeTrackerService: TimeTrackerService) {}

	ngOnInit() {
		this.timeTrackerService.getTimerStatus().then((timeLog: TimeLog) => {
			if (!timeLog.stoppedAt) {
				var stillUtc = moment.utc(timeLog.startedAt).toDate();
				var localStartedAt = moment(stillUtc)
					.local()
					.toDate();
				this.timeTrackerService.dueration = moment().diff(
					localStartedAt,
					'seconds'
				);
			}
		});

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

	toggle(type: string) {
		this.timeTrackerService.toggle();
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
