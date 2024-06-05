import { Component, OnDestroy, OnInit } from '@angular/core';
import { IOrganization, ITask } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DefaultEditor } from 'angular2-smart-table';
import { Store } from '@gauzy/ui-sdk/common';
import { TasksStoreService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	template: `
		<nb-select
			fullWidth
			[placeholder]="'INVOICES_PAGE.SELECT_TASK' | translate"
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
export class InvoiceTasksSelectorComponent extends DefaultEditor implements OnInit, OnDestroy {
	public tasks: ITask[] = [];
	public task: ITask;
	public tasks$: Observable<ITask[]> = this.tasksStore.tasks$;
	public organization: IOrganization;

	constructor(private readonly tasksStore: TasksStoreService, private readonly store: Store) {
		super();
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._loadTasks()),
				untilDestroyed(this)
			)
			.subscribe();
		this.tasks$
			.pipe(
				tap((tasks) => (this.tasks = tasks)),
				// tap(() => this.task = this.tasks.find((t) => t.id === this.cell.newValue.id)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 */
	private _loadTasks() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.tasksStore.fetchTasks(tenantId, organizationId).pipe(untilDestroyed(this)).subscribe();
	}

	/**
	 *
	 * @param task
	 */
	selectTask(task: ITask) {
		// this.cell.newValue = task;
	}

	ngOnDestroy() {}
}
