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
	tasks$: Observable<ITask[]> = this.tasksStore.tasks$;
	organization: IOrganization;

	constructor(
		private readonly tasksStore: TasksStoreService, 
		private readonly store: Store
	) {
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
		this.tasks$
			.pipe(
				tap((tasks) => this.tasks = tasks),
				tap(() => this.task = this.tasks.find((t) => t.id === this.cell.newValue.id)),
				untilDestroyed(this)
			).subscribe();
	}

	private _loadTasks() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.tasksStore
			.fetchTasks(tenantId, organizationId)
			.pipe(untilDestroyed(this))
			.subscribe();
	}

	selectTask($event) {
		this.cell.newValue = $event;
	}

	ngOnDestroy() {}
}
