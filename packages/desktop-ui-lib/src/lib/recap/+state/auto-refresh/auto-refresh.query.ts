import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { AutoRefreshStore, IAutoRefreshState } from './auto-refresh.store';

@Injectable({ providedIn: 'root' })
export class AutoRefreshQuery extends Query<IAutoRefreshState> {
	public readonly enabled$: Observable<boolean> = this.select((state) => state.enabled);
	constructor(protected store: AutoRefreshStore) {
		super(store);
	}

	public get enabled() {
		return this.getValue().enabled;
	}
}
