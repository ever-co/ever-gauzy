import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ICamshot } from '../../shared/models/camshot.model';

export interface ICamshotState {
	count: number;
	camshots: ICamshot[];
	camshot: ICamshot | null;
	deleting: boolean;
	restoring: boolean;
	downloading: boolean;
}

export function createInitialState(): ICamshotState {
	return {
		camshots: [],
		camshot: null,
		count: 0,
		deleting: false,
		restoring: false,
		downloading: false
	};
}

@StoreConfig({ name: 'camshots' })
@Injectable({ providedIn: 'root' })
export class CamshotStore extends Store<ICamshotState> {
	constructor() {
		super(createInitialState());
	}
}
