import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { CamshotStore, ICamshotState } from './camshot.store';
import { ICamshot, Camshot } from '../../shared/models/camshot.model';

@Injectable({ providedIn: 'root' })
export class CamshotQuery extends Query<ICamshotState> {
	public readonly camshots$: Observable<Camshot[]> = this.select((state) => state.camshots.map(items => new Camshot(items)));
	public readonly camshot$: Observable<Camshot | null> = this.select((state) => state.camshot ? new Camshot(state.camshot) : null);
	public readonly count$: Observable<number> = this.select((state) => state.count);
	public readonly isLoading$: Observable<boolean> = this.selectLoading();
	public readonly isAvailable$: Observable<boolean> = this.select((state) => state.count > 0);

	constructor(readonly camshotStore: CamshotStore) {
		super(camshotStore);
	}

	public get camshot(): ICamshot | null {
		const camshot = this.getValue().camshot;
		return camshot ? new Camshot(camshot) : null;
	}

	public get camshots(): ICamshot[] {
		return this.getValue().camshots.map(items => new Camshot(items)) || [];
	}

	public get count(): number {
		return this.getValue().count || 0;
	}
}
