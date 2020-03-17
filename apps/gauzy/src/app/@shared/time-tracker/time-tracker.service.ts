import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TimeLog, ITimerToggleInput } from '@gauzy/models';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class TimeTrackerService {
	_dueration: BehaviorSubject<number>;
	_running: BehaviorSubject<boolean>;
	dataStore: {
		dueration: number;
		running: boolean;
	};
	interval: any;

	constructor(private http: HttpClient) {
		this.dataStore = { dueration: 0, running: false };
		this._dueration = new BehaviorSubject(this.dataStore.dueration);
		this._running = new BehaviorSubject(this.dataStore.running);
	}

	public get $dueration(): Observable<number> {
		return this._dueration.asObservable();
	}
	public get dueration(): number {
		return this.dataStore.dueration;
	}
	public set dueration(value: number) {
		this.dataStore.dueration = value;
		this._dueration.next(this.dataStore.dueration);
	}

	public get $running(): Observable<boolean> {
		return this._running.asObservable();
	}
	public get running(): boolean {
		return this.dataStore.running;
	}
	public set running(value: boolean) {
		this.dataStore.running = value;
		this._running.next(this.dataStore.running);
	}

	getTimerStatus(): Promise<TimeLog> {
		return this.http
			.get<TimeLog>('/api/timesheet/timer/status')
			.toPromise();
	}

	toggleTimer(request: ITimerToggleInput): Promise<TimeLog> {
		return this.http
			.post<TimeLog>('/api/timesheet/timer/toggle', request)
			.toPromise();
	}

	toggle() {
		if (this.interval) {
			this.running = false;
			this.turnOffTimer();
		} else {
			this.running = true;
			this.turnOnTimer();
		}
	}

	turnOnTimer() {
		this.interval = setInterval(() => {
			this.dueration++;
		}, 1000);
	}

	turnOffTimer() {
		clearInterval(this.interval);
		this.interval = null;
	}
}
