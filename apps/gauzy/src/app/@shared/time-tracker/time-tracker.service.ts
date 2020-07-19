import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	TimeLog,
	ITimerToggleInput,
	TimeLogType,
	TimerStatus
} from '@gauzy/models';
import { toLocal } from 'libs/utils';
import * as moment from 'moment';
import { StoreConfig, Store, Query } from '@datorama/akita';

export interface TimerState {
	showTimerWindow: boolean;
	dueration: number;
	current_session_dueration: number;
	running: boolean;
	timerConfig: ITimerToggleInput;
}

export function createInitialTimerState(): TimerState {
	let timerConfig = {
		isBillable: true,
		projectId: null,
		taskId: null,
		clientId: null,
		description: '',
		logType: TimeLogType.TRACKED,
		tags: []
	};
	try {
		const config = localStorage.getItem('timerConfig');
		if (config) {
			timerConfig = {
				...timerConfig,
				...JSON.parse(config)
			};
		}
	} catch (error) {}
	return {
		showTimerWindow: false,
		dueration: 0,
		current_session_dueration: 0,
		running: false,
		timerConfig
	} as TimerState;
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'timer' })
export class TimerStore extends Store<TimerState> {
	constructor() {
		super(createInitialTimerState());
	}
}

@Injectable({ providedIn: 'root' })
export class TimerQuery extends Query<TimerState> {
	constructor(protected store: TimerStore) {
		super(store);
	}
}

@Injectable({
	providedIn: 'root'
})
export class TimeTrackerService {
	interval: any;

	$showTimerWindow = this.timerQuery.select((state) => state.showTimerWindow);
	$dueration = this.timerQuery.select((state) => state.dueration);
	$current_session_dueration = this.timerQuery.select(
		(state) => state.current_session_dueration
	);
	$running = this.timerQuery.select((state) => state.running);
	$timerConfig = this.timerQuery.select((state) => state.timerConfig);

	constructor(
		protected timerStore: TimerStore,
		protected timerQuery: TimerQuery,
		private http: HttpClient
	) {
		this.getTimerStatus()
			.then((status: TimerStatus) => {
				this.dueration = status.duration;
				if (status.lastLog && !status.lastLog.stoppedAt) {
					this.current_session_dueration = moment().diff(
						toLocal(status.lastLog.startedAt),
						'seconds'
					);
				} else {
					this.current_session_dueration = 0;
				}

				if (status.running) {
					this.turnOnTimer();
				}
			})
			.catch(() => {});
	}

	public get showTimerWindow(): boolean {
		const { showTimerWindow } = this.timerQuery.getValue();
		return showTimerWindow;
	}
	public set showTimerWindow(value: boolean) {
		this.timerStore.update({
			showTimerWindow: value
		});
	}

	public get dueration(): number {
		const { dueration } = this.timerQuery.getValue();
		return dueration;
	}
	public set dueration(value: number) {
		this.timerStore.update({
			dueration: value
		});
	}

	public get current_session_dueration(): number {
		const { current_session_dueration } = this.timerQuery.getValue();
		return current_session_dueration;
	}
	public set current_session_dueration(value: number) {
		this.timerStore.update({
			current_session_dueration: value
		});
	}

	public get timerConfig(): ITimerToggleInput {
		const { timerConfig } = this.timerQuery.getValue();
		return timerConfig;
	}
	public set timerConfig(value: ITimerToggleInput) {
		localStorage.setItem('timerConfig', JSON.stringify(value));
		this.timerStore.update({
			timerConfig: value
		});
	}

	public get running(): boolean {
		const { running } = this.timerQuery.getValue();
		return running;
	}
	public set running(value: boolean) {
		this.timerStore.update({
			running: value
		});
	}

	getTimerStatus(): Promise<TimerStatus> {
		return this.http
			.get<TimerStatus>('/api/timesheet/timer/status')
			.toPromise();
	}

	toggleTimer(request: ITimerToggleInput): Promise<TimeLog> {
		return this.http
			.post<TimeLog>('/api/timesheet/timer/toggle', request)
			.toPromise();
	}

	toggle() {
		if (this.interval) {
			this.turnOffTimer();
		} else {
			this.current_session_dueration = 0;
			this.turnOnTimer();
		}

		this.toggleTimer(this.timerConfig);
	}

	turnOnTimer() {
		this.running = true;
		this.interval = setInterval(() => {
			this.dueration++;
			this.current_session_dueration++;
		}, 1000);
	}

	turnOffTimer() {
		this.running = false;
		clearInterval(this.interval);
		this.interval = null;
	}
}
