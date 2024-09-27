import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';

export interface ISearchTermState {
	value: string;
}

export function createInitialState(): ISearchTermState {
	return {
		value: ''
	};
}

@StoreConfig({ name: '_searchTerm' })
@Injectable({ providedIn: 'root' })
export class SearchTermStore extends Store<ISearchTermState> {
	constructor() {
		super(createInitialState());
	}
}
