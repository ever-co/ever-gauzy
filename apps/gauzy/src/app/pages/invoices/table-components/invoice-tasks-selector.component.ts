import { Component, OnDestroy, OnInit } from '@angular/core';
import { IOrganization, ITask } from '@gauzy/models';
import { Observable } from 'rxjs';
import { DefaultEditor } from 'ng2-smart-table';
import { TasksStoreService } from '../../../@core/services/tasks-store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '../../../@core/services/store.service';
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
	implements OnInit, OnDestroy {
	tasks: ITask[] = [];
	task: ITask;
	observableTasks: Observable<ITask[]> = this.tasksStore.tasks$;
	organization: IOrganization;

	constructor(
		private tasksStore: TasksStoreService,
		private storeService: Store
	) {
		super();
	}

	ngOnInit() {
		this.organization = this.storeService.selectedOrganization;
		this.observableTasks.pipe(untilDestroyed(this)).subscribe((data) => {
			this.tasks = data;
			const task = this.tasks.find((t) => t.id === this.cell.newValue);
			this.task = task;
		});
		this._loadTasks();
	}

	private async _loadTasks() {
		this.tasksStore.fetchTasks(this.organization);
	}

	selectTask($event) {
		this.cell.newValue = $event.id;
	}

	ngOnDestroy() {}
}
