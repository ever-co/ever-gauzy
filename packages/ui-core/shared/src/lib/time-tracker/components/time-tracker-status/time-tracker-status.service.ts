import { Injectable } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	BehaviorSubject,
	catchError,
	defer,
	EMPTY,
	filter,
	from,
	Observable,
	of,
	repeat,
	Subject,
	switchMap,
	tap
} from 'rxjs';
import { IEmployee, ITimerStatusWithWeeklyLimits, IUser } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { ITimerIcon, ITimerSynced, Store, TimeTrackerService } from '@gauzy/ui-core/core';
import { TimerIconFactory } from './factory';
import { TimerSynced } from './concretes';

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class TimeTrackerStatusService {
	private readonly _icon$: BehaviorSubject<ITimerIcon> = new BehaviorSubject<ITimerIcon>(null);
	private readonly _external$: Subject<ITimerSynced> = new Subject<ITimerSynced>();
	private readonly _userUpdate$: Subject<IUser> = new Subject();

	constructor(private readonly _timeTrackerService: TimeTrackerService, private readonly _store: Store) {
		defer(() =>
			of<boolean>(!!this._store.token && !!this._store.user?.employee).pipe(
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
					const remoteTimer = new TimerSynced({
						...status.lastLog,
						duration: status.duration
					});
					this._icon$.next(TimerIconFactory.create(remoteTimer.source));
					if (!remoteTimer.running || !remoteTimer.isExternalSource) this._icon$.next(null);
					this._external$.next(remoteTimer);
				}),
				repeat({
					delay: () => this._timeTrackerService.timer$
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.external$
			.pipe(
				distinctUntilChange(),
				tap((synced: ITimerSynced) => {
					this._timeTrackerService.timerSynced = synced;
					this._userUpdate$.next(synced.lastLog.employee);
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this._userUpdate$
			.pipe(
				distinctUntilChange(),
				filter((employee: IEmployee) => !!employee),
				tap((employee: IEmployee) => {
					this._store.user = {
						...this._store.user,
						employee
					};
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get icon$(): Observable<ITimerIcon> {
		return this._icon$.asObservable();
	}

	public get external$(): Observable<ITimerSynced> {
		return this._external$.asObservable();
	}

	public status(): Promise<ITimerStatusWithWeeklyLimits> {
		const { tenantId, organizationId } = this._timeTrackerService.timerConfig;
		return this._timeTrackerService.checkTimerStatus({
			tenantId,
			organizationId,
			relations: ['employee']
		});
	}
}
