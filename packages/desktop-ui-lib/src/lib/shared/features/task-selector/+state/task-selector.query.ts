import { Injectable } from '@angular/core';
import { ITask } from '@gauzy/contracts';
import { filter, map, Observable, startWith } from 'rxjs';
import { SelectorQuery } from '../../../+state/selector.query';
import { TaskSelectorStore } from './task-selector.store';

@Injectable({ providedIn: 'root' })
export class TaskSelectorQuery extends SelectorQuery<ITask> {
	constructor(protected store: TaskSelectorStore) {
		super(store);
	}

	public get selectedId(): ITask['id'] {
		return this.selected?.id ?? null;
	}

	public get selectedId$(): Observable<ITask['id']> {
		return this.selected$.pipe(
			filter(Boolean),
			map(({ id }) => id),
			startWith(null)
		);
	}
}
