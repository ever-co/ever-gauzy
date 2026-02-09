import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { ActivityWatchViewService } from '../activity-watch-view.service';
import { NbTooltipModule, NbToggleModule, NbIconModule } from '@nebular/theme';
import { AsyncPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'gauzy-activity-watch',
    templateUrl: './activity-watch.component.html',
    styleUrls: ['./activity-watch.component.scss'],
    imports: [NbTooltipModule, NbToggleModule, NbIconModule, AsyncPipe, TranslatePipe]
})
export class ActivityWatchComponent {
	constructor(private readonly activityWatchViewService: ActivityWatchViewService) {}

	public get isTimerRunning$(): Observable<boolean> {
		return this.activityWatchViewService.isTimerRunning$.asObservable();
	}

	public async setActivityWatch(isChecked: boolean): Promise<void> {
		this.activityWatchViewService.aw$.next(isChecked);
	}

	public get aw$(): Observable<boolean> {
		return this.activityWatchViewService.aw$.asObservable();
	}

	public get log$(): Observable<string> {
		return this.activityWatchViewService.log$.asObservable();
	}

	public get status$(): Observable<string> {
		return this.activityWatchViewService.status$.asObservable();
	}

	public get icon$(): Observable<string> {
		return this.activityWatchViewService.icon$.asObservable();
	}
}
