import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	TimeLog,
	ITimerToggleInput,
	TimeLogType,
	TimerStatus,
	OrganizationPermissionsEnum,
	Organization
} from '@gauzy/models';
import { toLocal } from 'libs/utils';
import * as moment from 'moment';
import { StoreConfig, Store, Query } from '@datorama/akita';
import { Store as AppStore } from '../../@core/services/store.service';
import { untilDestroyed } from 'ngx-take-until-destroy';

export interface TimerState {
	showTimerWindow: boolean;
	duration: number;
	current_session_duration: number;
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
		duration: 0,
		current_session_duration: 0,
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
export class TimeTrackerService implements OnDestroy {
	interval: any;

	showTimerWindow$ = this.timerQuery.select((state) => state.showTimerWindow);
	duration$ = this.timerQuery.select((state) => state.duration);
	current_session_duration$ = this.timerQuery.select(
		(state) => state.current_session_duration
	);
	$running = this.timerQuery.select((state) => state.running);
	$timerConfig = this.timerQuery.select((state) => state.timerConfig);
	organization: any;

	constructor(
		protected timerStore: TimerStore,
		protected timerQuery: TimerQuery,
		protected store: AppStore,
		private http: HttpClient
	) {
		this.getTimerStatus()
			.then((status: TimerStatus) => {
				this.duration = status.duration;
				if (status.lastLog && !status.lastLog.stoppedAt) {
					this.current_session_duration = moment().diff(
						toLocal(status.lastLog.startedAt),
						'seconds'
					);
				} else {
					this.current_session_duration = 0;
				}

				if (status.running) {
					this.turnOnTimer();
				}
			})
			.catch(() => {});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization: Organization) => {
				this.organization = organization;
			});
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

	public get duration(): number {
		const { duration } = this.timerQuery.getValue();
		return duration;
	}
	public set duration(value: number) {
		this.timerStore.update({
			duration: value
		});
	}

	public get current_session_duration(): number {
		const { current_session_duration } = this.timerQuery.getValue();
		return current_session_duration;
	}
	public set current_session_duration(value: number) {
		this.timerStore.update({
			current_session_duration: value
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

	startTimer() {
		if (!this.running) {
			if (this.canStartTimer()) {
				this.current_session_duration = 0;
				this.turnOnTimer();
			} else {
				this.showTimerWindow = true;
			}
		}
	}

	toggle() {
		if (this.interval) {
			this.turnOffTimer();
		} else {
			this.current_session_duration = 0;
			this.turnOnTimer();
		}

		this.toggleTimer(this.timerConfig);
	}

	turnOnTimer() {
		this.running = true;
		this.interval = setInterval(() => {
			this.duration++;
			this.current_session_duration++;
		}, 1000);
	}

	turnOffTimer() {
		this.running = false;
		clearInterval(this.interval);
		this.interval = null;
	}

	canStartTimer() {
		let isValid = true;
		if (this.organization) {
			if (
				this.organization.requireProject &&
				!this.timerConfig.projectId
			) {
				isValid = false;
			}
			if (this.organization.requireTask && !this.timerConfig.taskId) {
				isValid = false;
			}
			if (
				this.organization.requireDescription &&
				!this.timerConfig.description
			) {
				isValid = false;
			}
		} else {
			isValid = false;
		}
		return isValid;
	}

	ngOnDestroy(): void {}
}
