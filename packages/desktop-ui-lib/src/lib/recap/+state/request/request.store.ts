import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ITimeLogFilters, TimeLogSourceEnum } from '@gauzy/contracts';

export type IRequestState = ITimeLogFilters;

export function createInitialState(): IRequestState {
	return {
		source: [TimeLogSourceEnum.DESKTOP],
		logType: [],
		activityLevel: {
			start: 0,
			end: 100
		}
	};
}

@StoreConfig({ name: '_request' })
@Injectable({ providedIn: 'root' })
export class RequestStore extends Store<IRequestState> {
	constructor() {
		super(createInitialState());
	}
}
