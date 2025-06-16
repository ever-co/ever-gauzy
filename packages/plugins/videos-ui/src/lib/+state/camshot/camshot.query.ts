import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { CamshotStore, ICamshotState } from './camshot.store';
import { ICamshot } from '../../shared/models/camshot.model';

@Injectable({ providedIn: 'root' })
export class CamshotQuery extends Query<ICamshotState> {
	public readonly camshots$: Observable<ICamshot[]> = this.select((state) => state.camshots);
	public readonly camshot$: Observable<ICamshot | null> = this.select((state) => state.camshot);
	public readonly count$: Observable<number> = this.select((state) => state.count);
	public readonly isLoading$: Observable<boolean> = this.selectLoading();
	public readonly isAvailable$: Observable<boolean> = this.select((state) => state.count > 0);
	public readonly deleting$: Observable<boolean> = this.select((state) => state.deleting);
	public readonly restoring$: Observable<boolean> = this.select((state) => state.restoring);
	public readonly downloading$: Observable<boolean> = this.select((state) => state.downloading);

	constructor(readonly camshotStore: CamshotStore) {
		super(camshotStore);
	}

	public get camshot(): ICamshot | null {
		return this.getValue().camshot;
	}

	public get camshots(): ICamshot[] {
		return this.getValue().camshots || [];
	}

	public get count(): number {
		return this.getValue().count || 0;
	}
}
