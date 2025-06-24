import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ISoundshot } from '../../shared/models/soundshot.model';

export interface ISoundshotState {
	count: number;
	soundshots: ISoundshot[];
	soundshot: ISoundshot | null;
	deleting: boolean;
	restoring: boolean;
	downloading: boolean;
}

export function createInitialState(): ISoundshotState {
	return {
		soundshots: [],
		soundshot: null,
		count: 0,
		deleting: false,
		restoring: false,
		downloading: false
	};
}

@StoreConfig({ name: 'soundshots' })
@Injectable({ providedIn: 'root' })
export class SoundshotStore extends Store<ISoundshotState> {
	constructor() {
		super(createInitialState());
	}
}
