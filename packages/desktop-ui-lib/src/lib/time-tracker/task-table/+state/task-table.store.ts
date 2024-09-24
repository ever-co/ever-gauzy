import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ITask } from '@gauzy/contracts';

export interface ITaskTableState {
	data: ITask[];
	total: number;
	page: number;
}

export function createInitialState(): ITaskTableState {
	return {
		data: [],
		page: 1,
		total: 0
	};
}

@StoreConfig({ name: '_taskTable' })
@Injectable({ providedIn: 'root' })
export class TaskTableStore extends Store<ITaskTableState> {
	constructor() {
		super(createInitialState());
	}
}
