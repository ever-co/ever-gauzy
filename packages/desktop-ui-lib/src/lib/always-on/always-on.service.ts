import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ElectronService } from '../electron/services';

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
	constructor(private readonly _electronService: ElectronService) { }

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
}
