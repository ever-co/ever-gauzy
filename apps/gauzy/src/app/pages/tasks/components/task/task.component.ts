import { Component, OnInit, ViewChild } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { TaskDialogComponent } from '../task-dialog/task-dialog.component';
import { first } from 'rxjs/operators';
import { Task } from '@gauzy/models';
import { TasksStoreService } from 'apps/gauzy/src/app/@core/services/tasks-store.service';
import { Observable } from 'rxjs';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';

@Component({
	selector: 'ngx-task',
	templateUrl: './task.component.html',
	styleUrls: ['./task.component.scss']
})
export class TaskComponent extends TranslationBaseComponent implements OnInit {
	@ViewChild('tasksTable', { static: false }) tasksTable;

	settingsSmartTable: object = {
		actions: false,
		columns: {
			title: {
				title: this.getTranslation('TASKS_PAGE.TASKS_TITLE'),
				type: 'string',
				width: '10%'
			},
			description: {
				title: this.getTranslation('TASKS_PAGE.TASKS_DESCRIPTION'),
				type: 'string',
				filter: false
			},
			projectName: {
				title: this.getTranslation('TASKS_PAGE.TASKS_PROJECT'),
				type: 'string',
				filter: false
			},
			status: {
				title: this.getTranslation('TASKS_PAGE.TASKS_STATUS'),
				type: 'string',
				filter: false
			}
		}
	};
	loading = false;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	disableButton = true;
	tasks$: Observable<Task[]>;
	selectedTask: Task;

	constructor(
		private dialogService: NbDialogService,
		private _store: TasksStoreService,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this.tasks$ = this._store.tasks$;
	}

	ngOnInit() {}

	async createTaskDialog() {
		const dialog = this.dialogService.open(TaskDialogComponent, {
			context: {}
		});

		const data = await dialog.onClose.pipe(first()).toPromise();

		if (data) {
			this._store.createTask(data);
			this.selectTask({ isSelected: false, data: null });
		}
	}

	async editTaskDIalog() {
		const dialog = this.dialogService.open(TaskDialogComponent, {
			context: {
				selectedTask: this.selectedTask
			}
		});

		const data = await dialog.onClose.pipe(first()).toPromise();

		if (data) {
			this._store.editTask({
				...data,
				id: this.selectedTask.id
			});
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
}
