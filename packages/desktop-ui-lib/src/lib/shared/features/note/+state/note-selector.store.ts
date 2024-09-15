import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';

export interface INoteSelectorState {
	note: string;
}

export function createInitialState(): INoteSelectorState {
	return {
		note: ''
	};
}

@StoreConfig({ name: '_note' })
@Injectable({ providedIn: 'root' })
export class NoteSelectorStore extends Store<INoteSelectorState> {
	constructor() {
		super(createInitialState());
	}
}
