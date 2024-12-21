import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { ITimerIcon } from './interfaces';
import { TimeTrackerStatusService } from './time-tracker-status.service';

@Component({
    selector: 'gauzy-time-tracker-status',
    templateUrl: './time-tracker-status.component.html',
    styleUrls: ['./time-tracker-status.component.scss'],
    standalone: false
})
export class TimeTrackerStatusComponent {
	constructor(private readonly _timeTrackerStatusService: TimeTrackerStatusService) {}

	public get icon$(): Observable<ITimerIcon> {
		return this._timeTrackerStatusService.icon$;
	}
}
