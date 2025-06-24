import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { SoundshotStore, ISoundshotState } from './soundshot.store';
import { ISoundshot } from '../../shared/models/soundshot.model';

@Injectable({ providedIn: 'root' })
export class SoundshotQuery extends Query<ISoundshotState> {
	public readonly soundshots$: Observable<ISoundshot[]> = this.select((state) => state.soundshots);
	public readonly soundshot$: Observable<ISoundshot | null> = this.select((state) => state.soundshot);
	public readonly count$: Observable<number> = this.select((state) => state.count);
	public readonly isLoading$: Observable<boolean> = this.selectLoading();
	public readonly isAvailable$: Observable<boolean> = this.select((state) => state.count > 0);
	public readonly deleting$: Observable<boolean> = this.select((state) => state.deleting);
	public readonly restoring$: Observable<boolean> = this.select((state) => state.restoring);
	public readonly downloading$: Observable<boolean> = this.select((state) => state.downloading);

	constructor(readonly soundshotStore: SoundshotStore) {
		super(soundshotStore);
	}

	public get soundshot(): ISoundshot | null {
		return this.getValue().soundshot;
	}

	public get soundshots(): ISoundshot[] {
		return this.getValue().soundshots || [];
	}

	public get count(): number {
		return this.getValue().count || 0;
	}
}
