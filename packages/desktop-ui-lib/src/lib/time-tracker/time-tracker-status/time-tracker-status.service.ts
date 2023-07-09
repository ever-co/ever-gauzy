import { Injectable } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { ITimerStatus } from '@gauzy/contracts';
import { BehaviorSubject, filter, Observable, Subject, tap, timer } from 'rxjs';
import { TimerIconFactory } from './factory';
import { ITimerIcon, IRemoteTimer } from './interfaces';
import { RemoteTimer } from './concretes';
import { TimeTrackerService } from '../time-tracker.service';
import { Store } from '../../services';
import { BACKGROUND_SYNC_INTERVAL } from '../../constants/app.constants';

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class TimeTrackerStatusService {
	private _icon$: BehaviorSubject<ITimerIcon> = new BehaviorSubject<ITimerIcon>(null);
	private _external$: Subject<IRemoteTimer> = new Subject<IRemoteTimer>();
	private _backgroudSync$: Observable<number> = timer(0, BACKGROUND_SYNC_INTERVAL);
	private _remoteTimer: IRemoteTimer;
	constructor(private readonly _timeTrackerService: TimeTrackerService, private readonly _store: Store) {
		this._backgroudSync$
			.pipe(
				filter(() => !!this._store.token && !this._store.isOffline),
				tap(async () => {
					const status = await this.status();
					const remoteTimer = new RemoteTimer({
						...status.lastLog,
						duration: status.duration
					});
					this._icon$.next(TimerIconFactory.create(remoteTimer.source));
					if (!remoteTimer.running || !remoteTimer.isExternalSource) this._icon$.next(null);
					this._external$.next(remoteTimer);
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.external$
			.pipe(
				distinctUntilChange(),
				tap((remoteTimer: IRemoteTimer) => (this.remoteTimer = remoteTimer)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get icon$(): Observable<any> {
		return this._icon$.asObservable();
	}

	public get external$(): Observable<any> {
		return this._external$.asObservable();
	}

	public status(): Promise<ITimerStatus> {
		const { tenantId, organizationId } = this._store;
		return this._timeTrackerService.getTimerStatus({
			tenantId,
			organizationId
		});
	}

	public get remoteTimer(): IRemoteTimer {
		return this._remoteTimer;
	}

	public set remoteTimer(value: IRemoteTimer) {
		this._remoteTimer = value;
	}
}
