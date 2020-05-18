import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { MyTaskDialogComponent } from '../my-task-dialog/my-task-dialog.component';
import { first, takeUntil } from 'rxjs/operators';
import { Task, Tag } from '@gauzy/models';
import { MyTasksStoreService } from 'apps/gauzy/src/app/@core/services/my-tasks-store.service';
import { Observable, Subject } from 'rxjs';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { NotesWithTagsComponent } from 'apps/gauzy/src/app/@shared/table-components/notes-with-tags/notes-with-tags.component';
import { DateViewComponent } from 'apps/gauzy/src/app/@shared/table-components/date-view/date-view.component';
import { TaskEstimateComponent } from 'apps/gauzy/src/app/@shared/table-components/task-estimate/task-estimate.component';
import { AssignedToComponent } from 'apps/gauzy/src/app/@shared/table-components/assigned-to/assigned-to.component';

@Component({
	selector: 'ngx-my-task',
	templateUrl: './my-task.component.html',
	styleUrls: ['./my-task.component.scss']
})
export class MyTaskComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@ViewChild('tasksTable', { static: false }) tasksTable;
	private _ngDestroy$: Subject<void> = new Subject();
	settingsSmartTable: object;
	loading = false;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	disableButton = true;
	tasks$: Observable<Task[]>;
	selectedTask: Task;
	tags: Tag[];

	constructor(
		private dialogService: NbDialogService,
		private _store: MyTasksStoreService,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this.tasks$ = this._store.myTasks$;
	}

	ngOnInit() {
		this._store.fetchTasks();
		this._loadTableSettings();
		this._applyTranslationOnSmartTable();
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this._loadTableSettings();
			});
	}

	private _loadTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				title: {
					title: this.getTranslation('TASKS_PAGE.TASKS_TITLE'),
					type: 'string',
					width: '10%'
				},
				description: {
					title: this.getTranslation('TASKS_PAGE.TASKS_DESCRIPTION'),
					type: 'custom',
					filter: false,
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				},
				projectName: {
					title: this.getTranslation('TASKS_PAGE.TASKS_PROJECT'),
					type: 'string',
					filter: false
				},
				assignTo: {
					title: this.getTranslation('TASKS_PAGE.TASK_ASSIGNED_TO'),
					type: 'custom',
					filter: false,
					renderComponent: AssignedToComponent
				},
				estimate: {
					title: this.getTranslation('TASKS_PAGE.ESTIMATE'),
					type: 'custom',
					filter: false,
					renderComponent: TaskEstimateComponent
				},
				dueDate: {
					title: this.getTranslation('TASKS_PAGE.DUE_DATE'),
					type: 'custom',
					filter: false,
					renderComponent: DateViewComponent
				},
				status: {
					title: this.getTranslation('TASKS_PAGE.TASKS_STATUS'),
					type: 'string',
					filter: false
				}
			}
		};
	}

	async createTaskDialog() {
		const dialog = this.dialogService.open(MyTaskDialogComponent, {
			context: {}
		});

		const data = await dialog.onClose.pipe(first()).toPromise();

		if (data) {
			const { estimateDays, estimateHours, estimateMinutes } = data;

			const estimate =
				estimateDays * 24 * 60 * 60 +
				estimateHours * 60 * 60 +
				estimateMinutes * 60;

			estimate ? (data.estimate = estimate) : (data.estimate = null);

			this._store.createTask(data);
			this.selectTask({ isSelected: false, data: null });
		}
	}

	async editTaskDIalog() {
		const dialog = this.dialogService.open(MyTaskDialogComponent, {
			context: {
				selectedTask: this.selectedTask
			}
		});

		const data = await dialog.onClose.pipe(first()).toPromise();

		if (data) {
			const { estimateDays, estimateHours, estimateMinutes } = data;

			const estimate =
				estimateDays * 24 * 60 * 60 +
				estimateHours * 60 * 60 +
				estimateMinutes * 60;

			estimate ? (data.estimate = estimate) : (data.estimate = null);

			this._store.editTask({
				...data,
				id: this.selectedTask.id
			});
			this.selectTask({ isSelected: false, data: null });
		}
	}

	async duplicateTaskDIalog() {
		const selectedTask: Task = Object.assign({}, this.selectedTask);
		// while duplicate my task, default selected employee should be logged in employee
		selectedTask.members = null;
		const dialog = this.dialogService.open(MyTaskDialogComponent, {
			context: {
				selectedTask: selectedTask
			}
		});

		const data = await dialog.onClose.pipe(first()).toPromise();

		if (data) {
			const { estimateDays, estimateHours, estimateMinutes } = data;

			const estimate =
				estimateDays * 24 * 60 * 60 +
				estimateHours * 60 * 60 +
				estimateMinutes * 60;

			estimate ? (data.estimate = estimate) : (data.estimate = null);

			this._store.createTask(data);
			this.selectTask({ isSelected: false, data: null });
		}
	}

	async deleteTask() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			this._store.delete(this.selectedTask.id);
			this.selectTask({ isSelected: false, data: null });
		}
	}

	selectTask({ isSelected, data }) {
		const selectedTask = isSelected ? data : null;
		this.tasksTable.grid.dataSet.willSelect = false;
		this.disableButton = !isSelected;
		this.selectedTask = selectedTask;
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
