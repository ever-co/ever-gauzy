import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SegmentControlQuery } from './segment-control.query';
import { ISegmentControlState, SegmentControlStore } from './segment-control.store';

@Injectable({
	providedIn: 'root'
})
export class SegmentControlService {
	constructor(private readonly query: SegmentControlQuery, private readonly store: SegmentControlStore) {}

	public get segment$(): Observable<ISegmentControlState> {
		return this.query.state$;
	}

	public get segment(): ISegmentControlState {
		return this.query.getValue();
	}

	public set segment(segment: ISegmentControlState) {
		this.store.update(segment);
	}
}
