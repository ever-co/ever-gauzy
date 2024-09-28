import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';

export interface INoteSelectorState {
	note: string;
	disabled: boolean;
}

export function createInitialState(): INoteSelectorState {
	return {
		note: '',
		disabled: false
	};
}

@StoreConfig({ name: '_note' })
@Injectable({ providedIn: 'root' })
export class NoteSelectorStore extends Store<INoteSelectorState> {
	constructor() {
		super(createInitialState());
	}
}
