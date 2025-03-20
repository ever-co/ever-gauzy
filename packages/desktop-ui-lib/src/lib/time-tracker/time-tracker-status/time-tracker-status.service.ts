import { Injectable } from '@angular/core';
import { ITimerStatusWithWeeklyLimits } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	BehaviorSubject,
	catchError,
	defer,
	EMPTY,
	from,
	Observable,
	of,
	repeat,
	Subject,
	switchMap,
	tap,
	timer
} from 'rxjs';
import { BACKGROUND_SYNC_INTERVAL } from '../../constants/app.constants';
import { Store } from '../../services';
import { TimeTrackerService } from '../time-tracker.service';
import { RemoteTimer } from './concretes';
import { TimerIconFactory } from './factory';
import { IRemoteTimer, ITimerIcon } from './interfaces';

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class TimeTrackerStatusService {
	private readonly _icon$: BehaviorSubject<ITimerIcon> = new BehaviorSubject<ITimerIcon>(null);
	private readonly _external$: Subject<IRemoteTimer> = new Subject<IRemoteTimer>();
	private readonly _backgroundSync$: Observable<number> = timer(BACKGROUND_SYNC_INTERVAL);
	private _remoteTimer: IRemoteTimer;
	constructor(private readonly _timeTrackerService: TimeTrackerService, private readonly _store: Store) {
		defer(() =>
			of<boolean>(
				!!this._store.token &&
					!this._store.isOffline &&
					!!this._store.user.employee.id &&
					!!this._store.tenantId
			).pipe(
				switchMap((isEmployeeLoggedIn: boolean) =>
					isEmployeeLoggedIn
						? from(this.status()).pipe(
								catchError(() => EMPTY),
								untilDestroyed(this)
						  )
						: EMPTY
				),
				untilDestroyed(this)
			)
		)
			.pipe(
				tap((status: ITimerStatusWithWeeklyLimits) => {
					const remoteTimer = new RemoteTimer({
						...status.lastLog,
						duration: status.duration
					});
					this._icon$.next(TimerIconFactory.create(remoteTimer.source));
					if (!remoteTimer.running) this._icon$.next(null);
					this._external$.next(remoteTimer);
				}),
				repeat({
					delay: () => this._backgroundSync$
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

	public get icon$(): Observable<ITimerIcon> {
		return this._icon$.asObservable();
	}

	public get external$(): Observable<IRemoteTimer> {
		return this._external$.asObservable();
	}

	public status(): Promise<ITimerStatusWithWeeklyLimits> {
		if (!this._store?.tenantId || !this._store?.organizationId) {
			return;
		}
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
