import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ITask } from 'packages/contracts/dist';
import { filter, Observable, tap } from 'rxjs';
import { ElectronService } from '../../../electron/services';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { TaskSelectorQuery } from './+state/task-selector.query';
import { TaskSelectorService } from './+state/task-selector.service';
import { TaskSelectorStore } from './+state/task-selector.store';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-task-selector',
	templateUrl: './task-selector.component.html',
	styleUrls: ['./task-selector.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskSelectorComponent implements OnInit {
	constructor(
		private readonly electronService: ElectronService,
		public readonly taskSelectorStore: TaskSelectorStore,
		public readonly taskSelectorQuery: TaskSelectorQuery,
		private readonly timeTrackerQuery: TimeTrackerQuery,
		private readonly taskSelectorService: TaskSelectorService
	) {}

	public ngOnInit() {
		this.taskSelectorService
			.getAll$()
			.pipe(
				filter((data) => !data.some((value) => value.id === this.taskSelectorService.selectedId)),
				tap(() => (this.taskSelectorService.selected = null)),
				untilDestroyed(this)
			)
			.subscribe();
		this.taskSelectorService.onScroll$.pipe(untilDestroyed(this)).subscribe();
	}

	public refresh(): void {
		this.electronService.ipcRenderer.send('refresh-timer');
	}

	public addNewTask = async (name: ITask['title']) => {
		return this.taskSelectorService.addNewTask(name);
	};

	public get error$(): Observable<string> {
		return this.taskSelectorQuery.selectError();
	}

	public get selected$(): Observable<ITask> {
		return this.taskSelectorQuery.selected$;
	}

	public get data$(): Observable<ITask[]> {
		return this.taskSelectorQuery.data$;
	}

	public change(taskId: ITask['id']) {
		this.taskSelectorStore.updateSelected(taskId);
	}

	public get isLoading$(): Observable<boolean> {
		return this.taskSelectorQuery.selectLoading();
	}

	public get disabled$(): Observable<boolean> {
		return this.timeTrackerQuery.disabled$;
	}

	public get hasPermission$(): Observable<boolean> {
		return this.taskSelectorService.hasPermission$;
	}

	public onScrollToEnd(): void {
		this.taskSelectorService.onScrollToEnd();
	}
}
