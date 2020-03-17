import { Component, OnInit } from '@angular/core';
import { TimeTrackerService } from './time-tracker.service';
import { TimeLog, TimeLogType } from '@gauzy/models';
import * as moment from 'moment';

@Component({
	selector: 'ngx-time-tracker',
	templateUrl: './time-tracker.component.html',
	styleUrls: ['./time-tracker.component.scss']
})
export class TimeTrackerComponent implements OnInit {
	time: string = '00:00:00';
	subscription: any;
	interval: any;
	timeType: TimeLogType = TimeLogType.TRACKED;
	isBillable: boolean = true;

	private _dueration: number = 0;
	public get dueration(): number {
		return this._dueration;
	}
	public set dueration(totalSeconds: number) {
		this._dueration = totalSeconds;
		this.time = moment.utc(totalSeconds * 1000).format('HH:mm:ss');
	}

	constructor(private timeTrackerService: TimeTrackerService) {}

	ngOnInit() {
		this.timeTrackerService.getTimerStatus().then((timeLog: TimeLog) => {
			if (!timeLog.stoppedAt) {
				var stillUtc = moment.utc(timeLog.startedAt).toDate();
				var localStartedAt = moment(stillUtc)
					.local()
					.toDate();
				this.dueration = moment().diff(localStartedAt, 'seconds');
				this.turnOnTimer();
			}
		});
	}

	toggle() {
		if (this.interval) {
			this.turnOffTimer();
		} else {
			this.turnOnTimer();
		}
	}

	turnOnTimer(time?: Date) {
		this.interval = setInterval(() => {
			this.dueration++;
		}, 1000);
	}

	turnOffTimer() {
		clearInterval(this.interval);
		this.interval = null;
	}
}
