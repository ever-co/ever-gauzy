import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ITask } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { filter, Observable, of, tap } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { ToastrNotificationService } from '../../../services';
import { TaskSelectorService } from '../../../shared/features/task-selector/+state/task-selector.service';
import { TasksComponent } from '../../../tasks/tasks.component';
import { TaskDetailComponent } from '../../task-render/task-detail/task-detail.component';
import { ActionButtonQuery } from './+state/action-button.query';
import { ActionButton, ActionButtonStore } from './+state/action-button.store';

@Component({
	selector: 'ngx-action-button',
	templateUrl: './action-button.component.html',
	styleUrls: ['./action-button.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionButtonComponent {
	constructor(
		private readonly toastrService: ToastrNotificationService,
		private readonly electronService: ElectronService,
		private readonly taskSelectorService: TaskSelectorService,
		private readonly actionButtonStore: ActionButtonStore,
		private readonly actionButtonQuery: ActionButtonQuery,
		private readonly dialogService: NbDialogService
	) {}
	public add() {
		this.actionButtonStore.update({ action: ActionButton.ADD });
		this.dialogService
			.open(TasksComponent, {
				backdropClass: 'backdrop-blur'
			})
			.onClose.pipe(
				tap(() => this.onFinishAdding()),
				filter(Boolean),
				tap((result) => this.onCreateNewTask(result))
			)
			.subscribe();
	}
	public view() {
		this.actionButtonStore.update({ action: ActionButton.EDIT });
		this.dialogService
			.open(TaskDetailComponent, {
				context: {
					task: this.taskSelectorService.selected as any
				},
				backdropClass: 'backdrop-blur'
			})
			.onClose.pipe(tap(() => this.actionButtonStore.update({ action: ActionButton.NONE, toggle: false })))
			.subscribe();
	}
	public edit() {
		// TODO
	}
	public delete() {
		// TODO
	}

	public onFinishAdding() {
		this.actionButtonStore.update({ action: ActionButton.NONE, toggle: false });
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public onCreateNewTask({ isSuccess, message }): void {
		if (isSuccess) {
			this.toastrService.success(message);
			this.electronService.ipcRenderer.send('refresh-timer');
		} else {
			this.toastrService.error(message);
		}
	}
	public get task$(): Observable<ITask> {
		return this.taskSelectorService.selected$;
	}

	public get showHiddenButton$(): Observable<boolean> {
		// return combineLatest([this.task$, this.actionButtonQuery.toggle$]).pipe(
		// 	map(([task, toggle]) => !!task && toggle)
		// );
		return of(false); // TODO
	}
}
