import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ITimeTrackerFormState } from '../../shared/features/time-tracker-form/time-tracker-form.service';

export enum TimerStartMode {
	MANUAL = 'manual',
	REMOTE = 'remote',
	STOP = 'stop'
}

export enum IgnitionState {
	STARTING = 'starting',
	STOPPING = 'stopping',
	STARTED = 'started',
	STOPPED = 'stopped',
	RESTARTING = 'restarting',
	RESTARTED = 'restarted'
}

export interface ITimerIgnition {
	mode?: TimerStartMode;
	state?: IgnitionState;
	data?: ITimeTrackerFormState;
}

export interface ITimeTrackerState {
	isExpanded?: boolean;
	isRefreshing?: boolean;
	isEditing?: boolean;
	ignition?: ITimerIgnition;
}

export function createInitialState(): ITimeTrackerState {
	return {
		isExpanded: false,
		isRefreshing: false,
		isEditing: false,
		ignition: {
			mode: TimerStartMode.STOP,
			state: IgnitionState.STOPPED,
			data: {
				clientId: null,
				teamId: null,
				projectId: null,
				taskId: null,
				note: null
			}
		}
	};
}

@StoreConfig({ name: '_timeTracker' })
@Injectable({ providedIn: 'root' })
export class TimeTrackerStore extends Store<ITimeTrackerState> {
	constructor() {
		super(createInitialState());
	}

	public ignition(ignition: ITimerIgnition) {
		this.update({
			ignition: {
				...this.getValue().ignition,
				...ignition
			}
		});
	}
}
