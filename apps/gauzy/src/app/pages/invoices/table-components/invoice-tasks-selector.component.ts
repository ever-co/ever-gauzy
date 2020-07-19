import { Component, OnInit } from '@angular/core';
import { Task } from '@gauzy/models';
import { Observable } from 'rxjs';
import { DefaultEditor } from 'ng2-smart-table';
import { TasksStoreService } from '../../../@core/services/tasks-store.service';

@Component({
	template: `
		<nb-select
			fullWidth
			placeholder="{{ 'INVOICES_PAGE.SELECT_TASK' | translate }}"
			[(ngModel)]="task"
			(selectedChange)="selectTask($event)"
		>
			<nb-option *ngFor="let task of tasks" [value]="task">
				{{ task.title }}
			</nb-option>
		</nb-select>
	`,
	styles: []
})
export class InvoiceTasksSelectorComponent extends DefaultEditor
	implements OnInit {
	tasks: Task[] = [];
	task: Task;

	constructor(private tasksStore: TasksStoreService) {
		super();
		this.observableTasks = this.tasksStore.tasks$;
	}

	observableTasks: Observable<Task[]>;

	ngOnInit() {
		this._loadTasks();
	}

	private async _loadTasks() {
		this.tasksStore.fetchTasks();
		this.observableTasks.subscribe((data) => {
			this.tasks = data;
			const task = this.tasks.find((t) => t.id === this.cell.newValue);
			this.task = task;
		});
	}

	selectTask($event) {
		this.cell.newValue = $event.id;
	}
}
