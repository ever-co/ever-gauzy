import { ChangeDetectionStrategy, Component, forwardRef, OnInit } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ITask } from 'packages/contracts/dist';
import { debounceTime, filter, Observable, switchMap, tap } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { ElectronService } from '../../../electron/services';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { AbstractSelectorComponent } from '../../components/abstract/selector.abstract';
import { TaskSelectorQuery } from './+state/task-selector.query';
import { TaskSelectorService } from './+state/task-selector.service';
import { TaskSelectorStore } from './+state/task-selector.store';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-task-selector',
	templateUrl: './task-selector.component.html',
	styleUrls: ['./task-selector.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TaskSelectorComponent),
			multi: true
		}
	]
})
export class TaskSelectorComponent extends AbstractSelectorComponent<ITask> implements OnInit {
	constructor(
		private readonly electronService: ElectronService,
		public readonly taskSelectorStore: TaskSelectorStore,
		public readonly taskSelectorQuery: TaskSelectorQuery,
		private readonly timeTrackerQuery: TimeTrackerQuery,
		private readonly taskSelectorService: TaskSelectorService
	) {
		super();
	}

	public ngOnInit() {
		this.search$
			.pipe(
				debounceTime(300),
				distinctUntilChanged(),
				tap(() => this.taskSelectorService.resetPage()),
				switchMap((searchTerm) => this.taskSelectorService.load({ searchTerm })),
				untilDestroyed(this)
			)
			.subscribe();
		this.taskSelectorService
			.getAll$()
			.pipe(
				filter((data) => !data.some((value) => value.id === this.taskSelectorService.selectedId)),
				tap(() => (this.taskSelectorService.selected = null)),
				untilDestroyed(this)
			)
			.subscribe();
		this.taskSelectorService.onScroll$.pipe(untilDestroyed(this)).subscribe();
		// Handle search logic
		this.handleSearch(this.taskSelectorService);
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

	protected updateSelected(value: ITask): void {
		// Update store only if useStore is true
		if (this.useStore) {
			this.taskSelectorStore.updateSelected(value.id);
		}
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
