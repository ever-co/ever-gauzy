import { Injectable } from '@angular/core';
import { StoreConfig } from '@datorama/akita';
import { ITask } from '@gauzy/contracts';
import { SelectorStore } from '../../../+state/selector.store';
import { ISelector } from '../../../interfaces/selector.interface';

export type ITaskSelectorState = ISelector<ITask>;

export function createInitialState(): ITaskSelectorState {
	return {
		selected: null,
		data: []
	};
}

@StoreConfig({ name: '_taskSelector' })
@Injectable({ providedIn: 'root' })
export class TaskSelectorStore extends SelectorStore<ITask> {
	constructor() {
		super(createInitialState());
	}
}
