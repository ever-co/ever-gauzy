import { Component, Input, OnInit } from '@angular/core';
import { ITasksStatistics } from '@gauzy/contracts';

@Component({
	template: '',
})
export abstract class TaskRenderComponent implements OnInit {
	private _task: ITasksStatistics;

	constructor() { }

	ngOnInit(): void { }

	@Input('rowData')
	public set task(value: ITasksStatistics) {
		if (value) {
			this._task = value;
		}
	}

	public get task(): ITasksStatistics {
		return this._task;
	}
}
