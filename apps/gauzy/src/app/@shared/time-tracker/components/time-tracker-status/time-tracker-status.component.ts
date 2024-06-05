import { Component } from '@angular/core';
import { ITimerIcon } from '@gauzy/ui-sdk/core';
import { Observable } from 'rxjs';
import { TimeTrackerStatusService } from './time-tracker-status.service';

@Component({
	selector: 'ga-time-tracker-status',
	templateUrl: './time-tracker-status.component.html',
	styleUrls: ['./time-tracker-status.component.scss']
})
export class TimeTrackerStatusComponent {
	constructor(private readonly _timeTrackerStatusService: TimeTrackerStatusService) {}

	public get icon$(): Observable<ITimerIcon> {
		return this._timeTrackerStatusService.icon$;
	}
}
