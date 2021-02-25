import { Component, OnDestroy, OnInit } from '@angular/core';
import { IOrganization, ITask } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { DefaultEditor } from 'ng2-smart-table';
import { TasksStoreService } from '../../../@core/services/tasks-store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '../../../@core/services/store.service';
import { filter, tap } from 'rxjs/operators';
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

	constructor(private tasksStore: TasksStoreService, private store: Store) {
		super();
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(() => this._loadTasks()),
				untilDestroyed(this)
			)
			.subscribe();
		this.observableTasks.pipe(untilDestroyed(this)).subscribe((data) => {
			this.tasks = data;
			this.task = this.tasks.find((t) => t.id === this.cell.newValue.id);
		});
	}

	private _loadTasks() {
		this.tasksStore.fetchTasks(this.organization);
	}

	selectTask($event) {
		this.cell.newValue = $event;
	}

	ngOnDestroy() {}
}
