import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { ITimerIcon } from './interfaces';
import { TimeTrackerStatusService } from './time-tracker-status.service';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { NbTooltipModule } from '@nebular/theme';
import { AsyncPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'gauzy-time-tracker-status',
    templateUrl: './time-tracker-status.component.html',
    styleUrls: ['./time-tracker-status.component.scss'],
    imports: [FaIconComponent, NbTooltipModule, AsyncPipe, TranslatePipe]
})
export class TimeTrackerStatusComponent {
	constructor(private readonly _timeTrackerStatusService: TimeTrackerStatusService) {}

	public get icon$(): Observable<ITimerIcon> {
		return this._timeTrackerStatusService.icon$;
	}
}
