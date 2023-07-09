import { Injectable } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { ITimerStatus } from '@gauzy/contracts';
import { BehaviorSubject, filter, Observable, Subject, tap } from 'rxjs';
import { TimeTrackerService } from '../../time-tracker.service';
import { TimerIconFactory } from './factory';
import { ITimerIcon, ITimerSynced } from './interfaces';
import { TimerSynced } from './concretes';
import { Store } from '../../../../@core';

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class TimeTrackerStatusService {
	private _icon$: BehaviorSubject<ITimerIcon> = new BehaviorSubject<ITimerIcon>(null);
	private _external$: Subject<ITimerSynced> = new Subject<ITimerSynced>();
	constructor(private readonly _timeTrackerService: TimeTrackerService, private readonly _store: Store) {
		this._timeTrackerService.timer$
			.pipe(
				filter(() => !!this._store.token && !!this._store.user?.employee),
				tap(async () => {
					const status = await this.status();
					const timer = new TimerSynced({
						...status.lastLog,
						duration: status.duration
					});
					this._icon$.next(TimerIconFactory.create(timer.source));
					if (!timer.running || !timer.isExternalSource) this._icon$.next(null);
					this._external$.next(timer);
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.external$
			.pipe(
				distinctUntilChange(),
				tap((synced: ITimerSynced) => (this._timeTrackerService.timerSynced = synced)),
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
		const { tenantId, organizationId } = this._timeTrackerService.timerConfig;
		return this._timeTrackerService.getTimerStatus({
			tenantId,
			organizationId
		});
	}
}
