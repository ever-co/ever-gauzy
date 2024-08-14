import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';

export interface ISegmentControlState {
	icon?: string;
	title: string;
	path: string[];
}

export function createInitialState(): ISegmentControlState {
	return {
		icon: '',
		title: '',
		path: []
	};
}

@StoreConfig({ name: '_segmentControl' })
@Injectable({ providedIn: 'root' })
export class SegmentControlStore extends Store<ISegmentControlState> {
	constructor() {
		super(createInitialState());
	}
}
