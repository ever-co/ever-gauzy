import { Component } from '@angular/core';
import { ITask } from 'packages/contracts/dist';
import { Observable } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { TaskSelectorQuery } from './+state/task-selector.query';
import { TaskSelectorService } from './+state/task-selector.service';
import { TaskSelectorStore } from './+state/task-selector.store';

@Component({
	selector: 'gauzy-task-selector',
	templateUrl: './task-selector.component.html',
	styleUrls: ['./task-selector.component.scss']
})
export class TaskSelectorComponent {
	constructor(
		private readonly electronService: ElectronService,
		public readonly taskSelectorStore: TaskSelectorStore,
		public readonly taskSelectorQuery: TaskSelectorQuery,
		private readonly taskSelectorService: TaskSelectorService
	) {}

	public refresh(): void {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public addNewTask = async (name: ITask['title']) => {
		return this.taskSelectorService.addNewTask(name);
	};

	public get error$(): Observable<string> {
		return this.taskSelectorQuery.selectError();
	}

	public get selectedId$(): Observable<string> {
		return this.taskSelectorQuery.selectedId$;
	}

	public get data$(): Observable<ITask[]> {
		return this.taskSelectorQuery.data$;
	}

	public change(taskId: ITask['id']) {
		this.taskSelectorStore.updateSelected(taskId);
	}
}
