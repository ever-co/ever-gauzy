import { Component, OnInit } from '@angular/core';
import { ITask } from '@gauzy/models';
import { Observable } from 'rxjs';
import { DefaultEditor } from 'ng2-smart-table';
import { TasksStoreService } from '../../../@core/services/tasks-store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
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
export class InvoiceTasksSelectorComponent
	extends DefaultEditor
	implements OnInit {
	tasks: ITask[] = [];
	task: ITask;
	observableTasks: Observable<ITask[]> = this.tasksStore.tasks$;

	constructor(private tasksStore: TasksStoreService) {
		super();
	}

	ngOnInit() {
		this.observableTasks.pipe(untilDestroyed(this)).subscribe((data) => {
			this.tasks = data;
			const task = this.tasks.find((t) => t.id === this.cell.newValue);
			this.task = task;
		});
		this._loadTasks();
	}

	private async _loadTasks() {
		this.tasksStore.fetchTasks();
	}

	selectTask($event) {
		this.cell.newValue = $event.id;
	}
}
