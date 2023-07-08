import { Injectable } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { ITimerStatus } from '@gauzy/contracts';
import { BehaviorSubject, filter, Observable, Subject, tap, timer } from 'rxjs';
import { TimerIconFactory } from './factory';
import { ITimerIcon, ITimerSynced } from './interfaces';
import { TimerSynced } from './concretes';
import { TimeTrackerService } from '../time-tracker.service';
import { Store } from '../../services';

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root',
})
export class TimeTrackerStatusService {
	private _icon$: BehaviorSubject<ITimerIcon> =
		new BehaviorSubject<ITimerIcon>(null);
	private _external$: Subject<ITimerSynced> = new Subject<ITimerSynced>();
	constructor(
		private readonly _timeTrackerService: TimeTrackerService,
		private readonly _store: Store
	) {
		timer(0, 5000)
			.pipe(
				filter(
					() => !!this._store.token && !!this._store.user?.employee
				),
				tap(async () => {
					const status = await this.status();
					const timerSynced = new TimerSynced({
						...status.lastLog,
						duration: status.duration,
					});
					this._icon$.next(TimerIconFactory.create(timerSynced.source));
					if (!timerSynced.running || !timerSynced.isExternalSource)
						this._icon$.next(null);
					if (timerSynced.isExternalSource) {
						this._external$.next(timerSynced);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.external$
			.pipe(
				distinctUntilChange(),
				tap(
					(synced: ITimerSynced) =>
						(this._timeTrackerService.timerSynced = synced)
				),
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
			organizationId,
		});
	}
}
