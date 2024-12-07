import { Injectable, NgZone } from '@angular/core';
import { Observable, mergeMap, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IActivityWatchEventResult,
	IActivityWatchCollectEventData,
	IActivityWatchEventCollection,
	ActivityWatchEventType,
	ActivityWatchCollectEvent
} from '@gauzy/contracts';
import { ElectronService } from '../../electron/services/electron/electron.service';
import { ActivityWatchEventService } from './activity-watch-event.service';

interface IActivity {
	type: ActivityWatchEventType;
	ipcEvent: string;
	collectEventFn: (arg: IActivityWatchCollectEventData) => Promise<IActivityWatchEventCollection>;
	sendEventFn: (arg: IActivityWatchEventResult) => void;
}

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class ActivityWatchElectronService {
	private readonly activities: IActivity[];
	private isSetupLocked: boolean;

	constructor(
		private readonly electronService: ElectronService,
		private readonly activityWatchEventService: ActivityWatchEventService,
		private readonly ngZone: NgZone
	) {
		this.isSetupLocked = false;
		this.activities = [
			{
				type: ActivityWatchEventType.APP,
				ipcEvent: ActivityWatchCollectEvent.WINDOW,
				collectEventFn: async (arg) => this.activityWatchEventService.collectWindowsEvents(arg),
				sendEventFn: (result) => this.send('push_window_activity', result)
			},
			{
				type: ActivityWatchEventType.AFK,
				ipcEvent: ActivityWatchCollectEvent.AFK,
				collectEventFn: async (arg) => this.activityWatchEventService.collectAfkEvents(arg),
				sendEventFn: (result) => this.send('push_afk_activity', result)
			},
			{
				type: ActivityWatchEventType.URL,
				ipcEvent: ActivityWatchCollectEvent.CHROME,
				collectEventFn: async (arg) => this.activityWatchEventService.collectChromeEvents(arg),
				sendEventFn: (result) => this.send('push_chrome_activity', result)
			},
			{
				type: ActivityWatchEventType.URL,
				ipcEvent: ActivityWatchCollectEvent.FIREFOX,
				collectEventFn: async (arg) => this.activityWatchEventService.collectFirefoxEvents(arg),
				sendEventFn: (result) => this.send('push_firefox_activity', result)
			},
			{
				type: ActivityWatchEventType.URL,
				ipcEvent: ActivityWatchCollectEvent.EDGE,
				collectEventFn: async (arg) => this.activityWatchEventService.collectEdgeEvents(arg),
				sendEventFn: (result) => this.send('push_edge_activity', result)
			}
		];
	}

	public setupActivitiesCollection(): void {
		if (this.isSetupLocked) {
			return;
		}
		this.isSetupLocked = true;
		this.activities.forEach((activity) => {
			this.collectActivity(activity)
				.pipe(
					tap((result) => {
						this.ngZone.run(() => {
							activity.sendEventFn(result);
						});
					}),
					untilDestroyed(this)
				)
				.subscribe();
		});
	}

	public send<T>(channel: string, message?: T): void {
		this.electronService.ipcRenderer.send(channel, message);
	}

	private fromIpcEvent<T>(ipcEvent: string): Observable<T> {
		return new Observable((observer) => {
			this.electronService.ipcRenderer.on(ipcEvent, (_, arg: T) => {
				observer.next(arg);
			});
		});
	}

	private collectActivity(activity: IActivity): Observable<IActivityWatchEventResult> {
		return this.fromIpcEvent<IActivityWatchCollectEventData>(activity.ipcEvent).pipe(
			mergeMap(async (arg) => {
				const event = await activity.collectEventFn(arg);
				return {
					timerId: arg.timerId,
					type: activity.type,
					event
				};
			}),
			untilDestroyed(this)
		);
	}
}
