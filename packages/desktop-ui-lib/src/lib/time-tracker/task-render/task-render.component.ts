import { Component, Input } from '@angular/core';
import { ITasksStatistics } from '@gauzy/contracts';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ITaskRender extends ITasksStatistics {
	taskNumber: string;
	isSelected: boolean;
	todayDuration: number;
}

@Component({
    template: '',
    standalone: false
})
export abstract class TaskRenderComponent {
	private readonly _task$: BehaviorSubject<ITaskRender>;

	constructor() {
		this._task$ = new BehaviorSubject(null);
	}

	public get task(): ITaskRender {
		return this._task$.getValue();
	}

	public get task$(): Observable<ITaskRender> {
		return this._task$;
	}

	@Input()
	public set rowData(value: ITaskRender) {
		if (value) {
			this._task$.next(value);
		}
	}
}
