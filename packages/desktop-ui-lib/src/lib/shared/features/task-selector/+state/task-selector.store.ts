import { Injectable } from '@angular/core';
import { StoreConfig } from '@datorama/akita';
import { ITask } from '@gauzy/contracts';
import { SelectorStore } from '../../../+state/selector.store';
import { ISelector } from '../../../interfaces/selector.interface';

export type ITaskSelectorState = ISelector<ITask>;

export function createInitialState(): ITaskSelectorState {
	return {
		hasPermission: false,
		selected: null,
		data: [],
		total: 0,
		page: 1,
		limit: 10
	};
}

@StoreConfig({ name: '_taskSelector' })
@Injectable({ providedIn: 'root' })
export class TaskSelectorStore extends SelectorStore<ITask> {
	constructor() {
		super(createInitialState());
	}
}
