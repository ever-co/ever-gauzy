import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject, filter, tap } from 'rxjs';
import { ActivityWatchEventService } from './activity-watch-event.service';
import { GAUZY_ENV } from '../../constants';
import { ActivityWatchElectronService } from './activity-watch-electron.service';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class ActivityWatchViewService {
	private readonly _isTimerRunning$: BehaviorSubject<boolean>;
	private readonly _aw$: BehaviorSubject<boolean>;
	private readonly _icon$: BehaviorSubject<string>;
	private readonly _status$: BehaviorSubject<string>;
	private readonly _log$: BehaviorSubject<string>;

	constructor(
		private readonly activityWatchElectronService: ActivityWatchElectronService,
		private readonly activityWatchEventService: ActivityWatchEventService,
		@Inject(GAUZY_ENV)
		private readonly environment: any
	) {
		this._isTimerRunning$ = new BehaviorSubject(false);
		this._aw$ = new BehaviorSubject(false);
		this._icon$ = new BehaviorSubject('close-square-outline');
		this._status$ = new BehaviorSubject('success');
		this._log$ = new BehaviorSubject(null);
		this._status$
			.pipe(
				filter((status) => !!status),
				tap((status) => {
					this.activityWatchElectronService.send('aw_status', status === 'success');
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.aw$
			.pipe(
				distinctUntilChange(),
				tap(async (isChecked: boolean) => {
					await this.pingActivityWatchServer();
					this.activityWatchElectronService.send('set_tp_aw', {
						host: this.environment?.AWHost,
						isAw: isChecked
					});
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get isTimerRunning$(): BehaviorSubject<boolean> {
		return this._isTimerRunning$;
	}

	public get aw$(): BehaviorSubject<boolean> {
		return this._aw$;
	}

	public get aw(): boolean {
		return this._aw$.getValue();
	}

	public get icon$(): BehaviorSubject<string> {
		return this._icon$;
	}

	public get status$(): BehaviorSubject<string> {
		return this._status$;
	}

	public get log$(): BehaviorSubject<string> {
		return this._log$;
	}

	public async pingActivityWatchServer(): Promise<void> {
		if (!this.aw) {
			return;
		}
		const isAlive = await this.activityWatchEventService.ping();
		if (isAlive) {
			this.icon$.next('checkmark-square-outline');
			this.status$.next('success');
			this.log$.next('TIMER_TRACKER.AW_CONNECTED');
		} else {
			this.icon$.next('close-square-outline');
			this.status$.next('danger');
			this.log$.next('TIMER_TRACKER.AW_DISCONNECTED');
		}
	}
}
