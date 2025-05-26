import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable, timer } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import * as moment from 'moment';
import { StoreConfig, Store, Query } from '@datorama/akita';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { environment } from '@gauzy/ui-config';
import {
	ITimeLog,
	ITimerToggleInput,
	TimeLogType,
	ITimerStatus,
	IOrganization,
	TimerState,
	TimeLogSourceEnum,
	ITimerStatusInput,
	ITimerPosition
} from '@gauzy/contracts';
import { API_PREFIX, BACKGROUND_SYNC_INTERVAL, buildHttpParams, toLocal, toUTC } from '@gauzy/ui-core/common';
import { Store as AppStore } from '../store/store.service';
import { ITimerSynced } from './interfaces';

/**
 * Creates and returns the initial state for the timer.
 *
 * @returns The initial TimerState object.
 */
export function createInitialTimerState(): TimerState {
	const defaultTimerConfig = {
		isBillable: true,
		organizationId: null,
		tenantId: null,
		projectId: null,
		taskId: null,
		organizationContactId: null,
		organizationTeamId: null,
		description: null,
		logType: TimeLogType.TRACKED,
		source: TimeLogSourceEnum.WEB_TIMER,
		startedAt: null,
		stoppedAt: null
	};

	// Retrieve and parse the stored timer configuration, if available
	const storedConfig = (() => {
		try {
			return JSON.parse(localStorage.getItem('timerConfig') || '{}');
		} catch (error) {
			console.error('Error parsing timerConfig from localStorage:', error);
			return {};
		}
	})();

	// Merge default and stored configurations
	const timerConfig = { ...defaultTimerConfig, ...storedConfig };

	// Return the complete initial TimerState
	return {
		showTimerWindow: false,
		duration: 0,
		currentSessionDuration: 0,
		running: false,
		position: { x: 0, y: 0 },
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
	constructor(store: TimerStore) {
		super(store);
	}
}

@UntilDestroy()
@Injectable({
	providedIn: 'root'
})
export class TimeTrackerService implements OnDestroy {
	interval: any;
	showTimerWindow$ = this.timerQuery.select((state) => state.showTimerWindow);
	duration$ = this.timerQuery.select((state) => state.duration);
	currentSessionDuration$ = this.timerQuery.select((state) => state.currentSessionDuration);
	$running = this.timerQuery.select((state) => state.running);
	$timerConfig = this.timerQuery.select((state) => state.timerConfig);
	organization: IOrganization;

	private _trackType$: BehaviorSubject<string> = new BehaviorSubject(this.timeType);
	public trackType$: Observable<string> = this._trackType$.asObservable();
	private _worker: Worker;
	private _timerSynced: ITimerSynced;
	public timer$: Observable<number> = timer(BACKGROUND_SYNC_INTERVAL);

	constructor(
		protected readonly timerStore: TimerStore,
		protected readonly timerQuery: TimerQuery,
		protected readonly store: AppStore,
		private readonly http: HttpClient
	) {
		this._runWorker();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				this.timerStore.update({
					timerConfig: {
						...this.timerConfig,
						organizationId: organization.id,
						tenantId: organization.tenantId
					}
				});
			});
	}

	/*
	 * Check current timer status for employee only
	 */
	public async checkTimerStatus(payload: ITimerStatusInput) {
		delete payload.source;
		await this.getTimerStatus(payload)
			.then((status: ITimerStatus) => {
				this.duration = status.duration;
				if (status.lastLog && status.lastLog.isRunning) {
					this.currentSessionDuration = moment().diff(toLocal(status.lastLog.startedAt), 'seconds');
				} else {
					this.currentSessionDuration = 0;
				}

				// On refresh/delete TimeLog, we need to clear interval to prevent duplicate interval
				this.turnOffTimer();
				if (status.running) {
					this.turnOnTimer();
				}
			})
			.catch(() => {});
	}

	/**
	 * Gets the value indicating whether the timer window is shown.
	 *
	 * @returns A boolean indicating if the timer window is displayed.
	 */
	public get showTimerWindow(): boolean {
		return this.timerQuery.getValue().showTimerWindow;
	}

	/**
	 * Sets the value indicating whether to show the timer window.
	 *
	 * @param value - A boolean value to set for displaying the timer window.
	 */
	public set showTimerWindow(value: boolean) {
		this.timerStore.update({ showTimerWindow: value });
	}

	/**
	 * Gets the current duration of the timer.
	 *
	 * @returns The duration in seconds.
	 */
	public get duration(): number {
		return this.timerQuery.getValue().duration;
	}

	/**
	 * Sets the duration of the timer.
	 *
	 * @param value - A number representing the duration to set.
	 */
	public set duration(value: number) {
		this.timerStore.update({ duration: value });
	}

	/**
	 * Gets the current session duration of the timer.
	 *
	 * @returns The current session duration in seconds.
	 */
	public get currentSessionDuration(): number {
		return this.timerQuery.getValue().currentSessionDuration;
	}

	/**
	 * Sets the current session duration of the timer.
	 *
	 * @param value - A number representing the current session duration to set.
	 */
	public set currentSessionDuration(value: number) {
		this.timerStore.update({ currentSessionDuration: value });
	}

	/**
	 * Gets the configuration settings for the timer.
	 *
	 * @returns The timer configuration object.
	 */
	public get timerConfig(): ITimerToggleInput {
		return this.timerQuery.getValue().timerConfig;
	}

	/**
	 * Sets the configuration settings for the timer.
	 *
	 * @param value - An object containing the timer configuration to set.
	 */
	public set timerConfig(value: ITimerToggleInput) {
		this.timerStore.update({ timerConfig: value });
	}

	/**
	 * Gets the running state of the timer.
	 *
	 * @returns A boolean indicating if the timer is currently running.
	 */
	public get running(): boolean {
		return this.timerQuery.getValue().running;
	}

	/**
	 * Sets the running state of the timer.
	 *
	 * @param value - A boolean value to indicate whether the timer should be running.
	 */
	public set running(value: boolean) {
		this.timerStore.update({ running: value });
	}

	/**
	 * Gets the current position of the timer.
	 *
	 * @returns The current position or offset of the timer.
	 */
	public get position(): ITimerPosition {
		return this.timerQuery.getValue().position;
	}

	/**
	 * Sets the position of the timer.
	 *
	 * @param offset - The offset value to set for the timer's position.
	 */
	public set position(offset: ITimerPosition) {
		this.timerStore.update({ position: offset });
	}

	/**
	 * Retrieves the timer status using the provided parameters.
	 * @param input The input parameters for retrieving timer status.
	 * @returns A promise that resolves to the timer status.
	 */
	getTimerStatus(input: ITimerStatusInput): Promise<ITimerStatus> {
		const todayStart = toUTC(moment().startOf('day')).format('YYYY-MM-DD HH:mm:ss');
		const todayEnd = toUTC(moment().endOf('day')).format('YYYY-MM-DD HH:mm:ss');

		const params = buildHttpParams({ ...input, todayStart, todayEnd });
		return firstValueFrom(this.http.get<ITimerStatus>(`${API_PREFIX}/timesheet/timer/status`, { params }));
	}

	// toggleTimer(request: ITimerToggleInput): Promise<ITimeLog> {
	// 	return firstValueFrom(
	// 		this.http.post<ITimeLog>(`${API_PREFIX}/timesheet/timer/toggle`, request)
	// 	);
	// }

	openAndStartTimer() {
		this.showTimerWindow = true;
		if (!this.running) {
			if (this.canStartTimer()) {
				this.currentSessionDuration = 0;
				this.toggle();
			}
		}
	}

	toggle(): Promise<ITimeLog> {
		if (this.running) {
			this.turnOffTimer();
			delete this.timerConfig.source;
			this.timerConfig = {
				...this.timerConfig,
				stoppedAt: toUTC(moment()).toDate()
			};
			this.currentSessionDuration = 0;
			return firstValueFrom(this.http.post<ITimeLog>(`${API_PREFIX}/timesheet/timer/stop`, this.timerConfig));
		} else {
			this.currentSessionDuration = 0;
			this.turnOnTimer();
			this.timerConfig = {
				...this.timerConfig,
				startedAt: toUTC(moment()).toDate(),
				source: TimeLogSourceEnum.WEB_TIMER
			};
			return firstValueFrom(this.http.post<ITimeLog>(`${API_PREFIX}/timesheet/timer/start`, this.timerConfig));
		}
	}

	turnOnTimer() {
		this.running = true;
		// post state of timer to worker on start timer
		this._worker.postMessage({
			isRunning: this.running,
			session: this.currentSessionDuration,
			duration: this.duration
		});
	}

	turnOffTimer() {
		this.running = false;
		// post running state to worker on turning off
		this._worker.postMessage({
			isRunning: this.running
		});
	}

	canStartTimer() {
		let isValid = true;
		if (this.organization) {
			if (this.organization.requireProject && !this.timerConfig.projectId) {
				isValid = false;
			}
			if (this.organization.requireTask && !this.timerConfig.taskId) {
				isValid = false;
			}
			if (this.organization.requireDescription && !this.timerConfig.description) {
				isValid = false;
			}
		} else {
			isValid = false;
		}
		return isValid;
	}

	setTimeLogType(timeType: string) {
		this._trackType$.next(timeType);
		this.timeType = timeType === TimeLogType.TRACKED ? TimeLogType.TRACKED : TimeLogType.MANUAL;
	}

	public get timeType(): TimeLogType {
		return this.timerConfig.logType;
	}
	public set timeType(value: TimeLogType) {
		this.timerConfig = {
			...this.timerConfig,
			logType: value
		};
	}

	/*
	 * Clear time tracker local store
	 */
	clearTimeTracker() {
		this.timerStore.reset();
	}

	private _runWorker(): void {
		if (typeof Worker !== 'undefined') {
			try {
				this._worker = new Worker(new URL(environment.CLIENT_BASE_URL + '/assets/workers/time-tracker.js'), {
					type: 'module'
				});

				// retrieve message post from time tracker worker
				this._worker.onmessage = ({ data }) => {
					this.currentSessionDuration = data.session;
					this.duration = data.todayWorked;
				};
			} catch (error: any) {
				console.log('Invalid Time Tracker worker configuration', error?.message);
			}
		} else {
			console.log('Web worker does not supported on your browser');
		}
	}

	public remoteToggle(): ITimeLog {
		if (this.running) {
			this.turnOffTimer();
			this.timerConfig = {
				...this.timerConfig,
				source: this.timerSynced.source,
				startedAt: this.timerSynced.startedAt,
				stoppedAt: this.timerSynced.stoppedAt
			};
			this.currentSessionDuration = 0;
			return this.timerSynced.lastLog;
		} else {
			this.duration = this.timerSynced.lastLog.duration;
			this.timerConfig = {
				...this.timerConfig,
				organizationId: this.timerSynced.lastLog.organizationId,
				tenantId: this.timerSynced.lastLog.tenantId,
				projectId: this.timerSynced.lastLog.projectId,
				taskId: this.timerSynced.lastLog.taskId,
				organizationContactId: this.timerSynced.lastLog.organizationContactId,
				description: this.timerSynced.lastLog.description,
				source: this.timerSynced.source,
				startedAt: this.timerSynced.startedAt,
				stoppedAt: this.timerSynced.stoppedAt
			};
			this.turnOnTimer();
			return this.timerSynced.lastLog;
		}
	}

	public get timerSynced(): ITimerSynced {
		return this._timerSynced;
	}

	public set timerSynced(value: ITimerSynced) {
		this._timerSynced = value;
	}

	ngOnDestroy(): void {
		this._worker.terminate();
	}
}
