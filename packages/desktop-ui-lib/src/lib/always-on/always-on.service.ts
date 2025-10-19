import { Injectable } from '@angular/core';
import { Observable, interval, shareReplay } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { ElectronService } from '../electron/services';
import * as moment from "moment/moment";

export interface ITimerStatus {
	duration: number;
	running: boolean;
	lastLog: LastLog | null;
	startedAt?: Date;
}

export interface LastLog {
	deletedAt: any
	createdAt: string
	updatedAt: string
	createdByUserId: string
	updatedByUserId: string
	deletedByUserId: any
	id: string
	isActive: boolean
	isArchived: boolean
	archivedAt: any
	tenantId: string
	organizationId: string
	startedAt: string
	stoppedAt: string
	editedAt: any
	logType: string
	source: string
	description: any
	reason: any
	isBillable: boolean
	isRunning: boolean
	version: any
	employeeId: string
	timesheetId: string
	projectId: any
	taskId: any
	organizationContactId: any
	organizationTeamId: any
	duration: number
	isEdited: boolean
}

export enum AlwaysOnStateEnum {
	STARTED = 'Started',
	STOPPED = 'Stopped',
	LOADING = 'loading',
}

export interface ITimeCounter {
	current: string;
	today: string;
}

@Injectable({
	providedIn: 'root',
})
export class AlwaysOnService {
	private todayBase = 0;
	private currentBase = 0;
	private startTime: Date | null = null;
	private intervalCounter$?: Observable<ITimeCounter>;
	constructor(
		private readonly _electronService: ElectronService,
	) { }

	public run(state: AlwaysOnStateEnum) {
		this._electronService.ipcRenderer.send('change_state_from_ao', state);
	}

	public get state$(): Observable<AlwaysOnStateEnum> {
		return new Observable((observer) => {
			this._electronService.ipcRenderer.on(
				'change_state_from_ao',
				(_, state: AlwaysOnStateEnum) => {
					observer.next(state);
				}
			);
		});
	}

	public get counter$(): Observable<ITimeCounter> {
		return new Observable((observer) => {
			this._electronService.ipcRenderer.on(
				'ao_time_update',
				(_, count: ITimeCounter) => {
					observer.next(count);
				}
			);
		});
	}

	public update(current: string, today: number): void {
		this._electronService.ipcRenderer.send('ao_time_update', {
			today: moment.duration(today, 'seconds').format('HH:mm', {
				trim: false,
				trunc: true
			}),
			current
		});
	}

	init(today_duration: number, startedAt: Date) {
		this.todayBase = today_duration;
		this.currentBase = 0;
		this.startTime = startedAt;
	}



	public get localCounter$(): Observable<ITimeCounter> {
		if (!this.intervalCounter$) {
			this.intervalCounter$ = interval(1000).pipe(
				startWith(0),
				map(() => this.getCounters()),
				shareReplay(1)
			);
		}
		return this.intervalCounter$;
	}

	public get checkTimerStatus$(): Observable<number> {
		return new Observable((observer) => {
			this._electronService.ipcRenderer.on(
				'check_timer_status',
				(_, arg: number) => {
					observer.next(arg);
				}
			);
		});
	}

	private getCounters(): ITimeCounter {
		if (!this.startTime) {
			return { today: this.format(this.todayBase || 0), current: this.format(this.currentBase) };
		}

		const elapsedSec = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

		return {
			today: this.format(this.todayBase + elapsedSec),
			current: this.format(this.currentBase + elapsedSec),
		};
	}

	private format(totalSeconds: number): string {
		const h = Math.floor(totalSeconds / 3600);
		const m = Math.floor((totalSeconds % 3600) / 60);
		const s = totalSeconds % 60;
		return `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
	}

	private pad(n: number): string {
		return n < 10 ? '0' + n : n.toString();
	}

	public async getTimerStatus(): Promise<ITimerStatus> {
		const timerStatus = await this._electronService.ipcRenderer.invoke('timer_status');
		return timerStatus;
	}

	public async toggleTimer() {
		const timerStatus = await this._electronService.ipcRenderer.invoke('toggle_timer');
		return timerStatus;
	}
}
