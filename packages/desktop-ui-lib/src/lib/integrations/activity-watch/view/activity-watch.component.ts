import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { ActivityWatchViewService } from '../activity-watch-view.service';
import { ActivityWatchElectronService } from '../activity-watch-electron.service';

@Component({
	selector: 'gauzy-activity-watch',
	templateUrl: './activity-watch.component.html',
	styleUrls: ['./activity-watch.component.scss']
})
export class ActivityWatchComponent {
	constructor(
		private readonly activityWatchViewService: ActivityWatchViewService,
		private readonly activityWatchElectronService: ActivityWatchElectronService
	) {
		activityWatchElectronService.setupActivitiesCollection();
	}

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
