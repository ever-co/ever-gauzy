import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	ITimeLog,
	ITimerToggleInput,
	TimeLogType,
	ITimerStatus,
	IOrganization,
	TimerState,
	TimeLogSourceEnum,
	ITimerStatusInput
} from '@gauzy/contracts';
import { toLocal, toParams, toUTC } from '@gauzy/common-angular';
import * as moment from 'moment';
import { StoreConfig, Store, Query } from '@datorama/akita';
import { Store as AppStore } from '../../@core/services/store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { firstValueFrom, Observable } from 'rxjs';
import { API_PREFIX } from '../../@core/constants/app.constants';

export function createInitialTimerState(): TimerState {
	let timerConfig = {
		isBillable: true,
		organizationId: null,
		tenantId: null,
		projectId: null,
		taskId: null,
		organizationContactId: null,
		description: '',
		logType: TimeLogType.TRACKED,
		source: TimeLogSourceEnum.WEB_TIMER,
		tags: [],
		startedAt: null,
		stoppedAt: null
	};
	try {
		const config = localStorage.getItem('timerConfig');
		if (config) {
			timerConfig = {
				...timerConfig,
				...JSON.parse(config)
			};
		}
	} catch (error) { }
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
	constructor(protected readonly store: TimerStore) {
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
	currentSessionDuration$ = this.timerQuery.select(
		(state) => state.currentSessionDuration
	);
	$running = this.timerQuery.select((state) => state.running);
	$timerConfig = this.timerQuery.select((state) => state.timerConfig);
	organization: IOrganization;

	private _trackType$: BehaviorSubject<string> = new BehaviorSubject(
		this.timeType
	);
	public trackType$: Observable<string> = this._trackType$.asObservable();
	private _worker: Worker;

	constructor(
		protected timerStore: TimerStore,
		protected timerQuery: TimerQuery,
		protected store: AppStore,
		private http: HttpClient
	) {
		this._runWorker();
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				const { tenantId } = this.store.user;
				this.organization = organization;
				if (organization) {
					this.timerStore.update({
						timerConfig: {
							...this.timerConfig,
							organizationId: organization.id,
							tenantId
						}
					});
				}
			});
	}

	/*
	 * Check current timer status for employee only
	 */
	public async checkTimerStatus(payload: ITimerStatusInput) {
		await this.getTimerStatus(payload)
			.then((status: ITimerStatus) => {
				this.duration = status.duration;
				if (status.lastLog && status.lastLog.isRunning) {
					this.currentSessionDuration = moment().diff(
						toLocal(status.lastLog.startedAt),
						'seconds'
					);
				} else {
					this.currentSessionDuration = 0;
				}

				// On refresh/delete TimeLog, we need to clear interval to prevent duplicate interval
				this.turnOffTimer();
				if (status.running) {
					this.turnOnTimer();
				}
			})
			.catch(() => { });
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

	public get currentSessionDuration(): number {
		const { currentSessionDuration } = this.timerQuery.getValue();
		return currentSessionDuration;
	}
	public set currentSessionDuration(value: number) {
		this.timerStore.update({
			currentSessionDuration: value
		});
	}

	public get timerConfig(): ITimerToggleInput {
		const { timerConfig } = this.timerQuery.getValue();
		return timerConfig;
	}
	public set timerConfig(value: ITimerToggleInput) {
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

	public get position() {
		const { position } = this.timerQuery.getValue();
		return position;
	}
	public set position(offSet: any) {
		this.timerStore.update({
			position: offSet
		});
	}

	getTimerStatus(params: ITimerStatusInput): Promise<ITimerStatus> {
		return firstValueFrom(
			this.http.get<ITimerStatus>(`${API_PREFIX}/timesheet/timer/status`, {
				params: toParams({ ...params })
			})
		);
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

	toggle() {
		if (this.running) {
			this.turnOffTimer();
			this.timerConfig = {
				...this.timerConfig,
				stoppedAt: toUTC(moment()).toDate()
			};
			return firstValueFrom(
				this.http.post<ITimeLog>(
					`${API_PREFIX}/timesheet/timer/stop`,
					this.timerConfig
				)
			);
		} else {
			this.currentSessionDuration = 0;
			this.turnOnTimer();
			this.timerConfig = {
				...this.timerConfig,
				startedAt: toUTC(moment()).toDate()
			};
			return firstValueFrom(
				this.http.post<ITimeLog>(
					`${API_PREFIX}/timesheet/timer/start`,
					this.timerConfig
				)
			);
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

	setTimeLogType(timeType: string) {
		this._trackType$.next(timeType);
		this.timeType =
			timeType === TimeLogType.TRACKED ? TimeLogType.TRACKED : TimeLogType.MANUAL;
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
			// Initialize worker
			this._worker = new Worker(
				new URL('./time-tracker.worker', import.meta.url)
			);
			// // retrieve message post from time tracker worker
			this._worker.onmessage = ({ data }) => {
				this.currentSessionDuration = data.session;
				this.duration = data.todayWorked;
			};
		} else {
			// Web Workers are not supported in this environment.
			// You should add a fallback so that your program still executes correctly.
			console.log('Web worker does not supported on your browser');
		}
	}

	ngOnDestroy(): void { }
}
