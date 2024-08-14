import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { ISegmentControlState, SegmentControlStore } from './segment-control.store';

@Injectable({ providedIn: 'root' })
export class SegmentControlQuery extends Query<ISegmentControlState> {
	public readonly state$: Observable<ISegmentControlState> = this.select();
	constructor(protected store: SegmentControlStore) {
		super(store);
	}

	public get state(): ISegmentControlState {
		return this.getValue();
	}
}
