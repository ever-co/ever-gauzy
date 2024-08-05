import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';

export type IAutoRefreshState = {
	enabled: boolean;
};

export function createInitialState(): IAutoRefreshState {
	return {
		enabled: false
	};
}

@StoreConfig({ name: '_autoRefresh', cache: { ttl: 500 } })
@Injectable({ providedIn: 'root' })
export class AutoRefreshStore extends Store<IAutoRefreshState> {
	constructor() {
		super(createInitialState());
	}
}
