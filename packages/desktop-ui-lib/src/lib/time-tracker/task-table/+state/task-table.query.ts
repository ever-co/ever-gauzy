import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { ITask } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { ITaskTableState, TaskTableStore } from './task-table.store';

@Injectable({ providedIn: 'root' })
export class TaskTableQuery extends Query<ITaskTableState> {
	public readonly data$: Observable<ITask[]> = this.select((state) => state.data);
	public readonly total$: Observable<number> = this.select((state) => state.total);
	constructor(protected store: TaskTableStore) {
		super(store);
	}

	public get tasks(): ITask[] {
		return this.getValue().data;
	}

	public get total(): number {
		return this.getValue().total;
	}

	public get page(): number {
		return this.getValue().page;
	}
}
