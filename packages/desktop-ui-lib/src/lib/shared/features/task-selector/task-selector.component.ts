import { ChangeDetectionStrategy, Component, forwardRef, OnInit } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { ITask } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, map, Observable } from 'rxjs';
import { TimeTrackerQuery } from '../../../time-tracker/+state/time-tracker.query';
import { AbstractSelectorComponent } from '../../components/abstract/selector.abstract';
import { SelectorElectronService } from '../../services/selector-electron.service';
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
		private readonly selectorElectronService: SelectorElectronService,
		public readonly taskSelectorStore: TaskSelectorStore,
		public readonly taskSelectorQuery: TaskSelectorQuery,
		private readonly timeTrackerQuery: TimeTrackerQuery,
		private readonly taskSelectorService: TaskSelectorService
	) {
		super();
	}

	public ngOnInit() {
		// Subscribe to onScroll$
		this.taskSelectorService.onScroll$.pipe(untilDestroyed(this)).subscribe();
		// Handle search logic
		this.handleSearch(this.taskSelectorService);
	}

	public clear(): void {
		if (this.useStore) {
			this.selectorElectronService.update({ taskId: null });
			this.selectorElectronService.refresh();
		}
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

	protected updateSelected(value: ITask['id']): void {
		// Update store only if useStore is true
		if (this.useStore) {
			this.selectorElectronService.update({ taskId: value });
			this.taskSelectorStore.updateSelected(value);
		}
	}

	public get isLoading$(): Observable<boolean> {
		return this.taskSelectorQuery.selectLoading();
	}

	public get disabled$(): Observable<boolean> {
		return combineLatest([this.timeTrackerQuery.disabled$, this.isDisabled$.asObservable()]).pipe(
			map(([disabled, selectorDisabled]) => disabled || selectorDisabled)
		);
	}

	public get hasPermission$(): Observable<boolean> {
		return this.taskSelectorService.hasPermission$;
	}

	public onScrollToEnd(): void {
		this.taskSelectorService.onScrollToEnd();
	}
}
