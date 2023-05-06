import { Injectable } from '@angular/core';
import * as moment from 'moment';
import {
	BehaviorSubject,
	Observable,
	Subject,
	Subscription,
	tap,
	timer,
} from 'rxjs';

@Injectable({
	providedIn: 'root',
})
export class TimeTrackerCounterService {
	private _lastUpdate: Date;
	private _state$: Subject<boolean>;
	private _counter$: Subject<number>;
	private _timerSubscription: Subscription;

	constructor() {
		this._timerSubscription = new Subscription();
		this._state$ = new BehaviorSubject(false);
		this._counter$ = new Subject();
		this._lastUpdate = null;
		this._state$
			.pipe(
				tap((isNotRunning: boolean) => {
					isNotRunning ? this._start() : this._stop();
				})
			)
			.subscribe();
	}

	private _stop() {
		this._timerSubscription.unsubscribe();
		this._lastUpdate = null;
	}

	private _start() {
		this._lastUpdate = new Date();
		this._timerSubscription = timer(0, 1000)
			.pipe(
				tap(() => {
					const now = new Date();
					this._counter$.next(
						moment
							.duration(
								moment(now).diff(this._lastUpdate),
								'millisecond'
							)
							.asSeconds()
					);
					this._lastUpdate = now;
				})
			)
			.subscribe();
	}

	public get counter$(): Observable<number> {
		return this._counter$.asObservable();
	}

	public get state$(): Subject<boolean> {
		return this._state$;
	}
}
