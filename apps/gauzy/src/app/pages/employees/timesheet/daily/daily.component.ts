import { Component, OnInit } from '@angular/core';
import { TimeTrackerService } from 'apps/gauzy/src/app/@shared/time-tracker/time-tracker.service';
import { IGetTimeLogInput, TimeLog } from '@gauzy/models';
import { toUTC } from 'libs/utils';

@Component({
	selector: 'ngx-daily',
	templateUrl: './daily.component.html',
	styleUrls: ['./daily.component.scss']
})
export class DailyComponent implements OnInit {
	timeLogs: TimeLog[];
	date: Date = new Date();

	constructor(private timeTrackerService: TimeTrackerService) {}

	async ngOnInit() {
		const request: IGetTimeLogInput = {
			startDate: toUTC(this.date).format('YYYY-MM-DD'),
			endDate: toUTC(this.date).format('YYYY-MM-DD')
		};
		this.timeLogs = await this.timeTrackerService.getTimeLogs(request);
	}

	onDeleteConfirm(event) {
		if (window.confirm('Are you sure you want to delete?')) {
			event.confirm.resolve();
		} else {
			event.confirm.reject();
		}
	}
}
