import {
	Component,
	OnInit,
	Input,
	Output,
	EventEmitter,
	SimpleChanges,
	OnChanges
} from '@angular/core';
import { SprintStoreService } from 'apps/gauzy/src/app/@core/services/organization-sprint-store.service';
import { Task, OrganizationSprint, OrganizationProjects } from '@gauzy/models';
import { Observable } from 'rxjs';
import { map, tap, filter } from 'rxjs/operators';
import {
	CdkDragDrop,
	moveItemInArray,
	transferArrayItem
} from '@angular/cdk/drag-drop';
import { GauzyEditableGridComponent } from 'apps/gauzy/src/app/@shared/components/editable-grid/gauzy-editable-grid.component';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TasksStoreService } from 'apps/gauzy/src/app/@core/services/tasks-store.service';

@Component({
	selector: 'ga-tasks-sprint-view',
	templateUrl: './tasks-sprint-view.component.html',
	styleUrls: ['./tasks-sprint-view.component.scss']
})
export class TasksSprintViewComponent extends GauzyEditableGridComponent<Task>
	implements OnInit, OnChanges {
	sprints: OrganizationSprint[] = [];
	@Input() project: OrganizationProjects;
	backlogTasks: Task[] = [];
	@Output() createTaskEvent: EventEmitter<any> = new EventEmitter();
	@Output() editTaskEvent: EventEmitter<any> = new EventEmitter();
	@Output() deleteTaskEvent: EventEmitter<any> = new EventEmitter();
	sprints$: Observable<OrganizationSprint[]> = this.store$.sprints$.pipe(
		filter((sprints: OrganizationSprint[]) => Boolean(sprints.length)),
		map((sprints: OrganizationSprint[]): OrganizationSprint[] =>
			sprints.filter(
				(sprint: OrganizationSprint) =>
					sprint.projectId === this.project.id
			)
		),
		tap((sprints: OrganizationSprint[]) => {
			this.sprintIds = [
				...sprints.map((sprint: OrganizationSprint) => sprint.id),
				'backlog'
			];
		})
	);

	sprintIds: string[] = [];
	sprintActions: { title: string }[] = [];

	constructor(
		private store$: SprintStoreService,
		translateService: TranslateService,
		dialogService: NbDialogService,
		private taskStore: TasksStoreService
	) {
		super(translateService, dialogService);
	}

	ngOnInit(): void {
		this.sprintActions = [
			{ title: 'Edit sprint' },
			{ title: 'Delete Sprint' }
		];
	}

	reduceTasks(tasks: Task[]): void {
		this.sprints$.subscribe((availableSprints: OrganizationSprint[]) => {
			const sprints = availableSprints.reduce(
				(
					acc: { [key: string]: OrganizationSprint },
					sprint: OrganizationSprint
				) => {
					acc[sprint.id] = { ...sprint, tasks: [] };
					return acc;
				},
				{}
			);
			const backlog = [];
			tasks.forEach((task) => {
				if (!!task.organizationSprint) {
					sprints[task.organizationSprint.id].tasks.push(task);
				} else {
					backlog.push(task);
				}
			});
			this.sprints = Object.values(sprints);
			this.backlogTasks = backlog;
		});
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (!!changes && !!changes.tasks) {
			this.reduceTasks(changes.tasks.currentValue);
		}
	}

	createTask(): void {
		this.createTaskEvent.emit();
	}

	editTask(selectedItem: Task): void {
		this.editTaskEvent.emit(this.selectedItem || selectedItem);
	}

	deleteTask(selectedItem: Task): void {
		this.deleteTaskEvent.emit(selectedItem);
	}

	drop(event: CdkDragDrop<string[]>) {
		if (event.previousContainer === event.container) {
			moveItemInArray(
				event.container.data,
				event.previousIndex,
				event.currentIndex
			);
		} else {
			this.taskStore.editTask({
				id: event.item.data.id,
				title: event.item.data.title,
				organizationSprint: this.sprints.find(
					(sprint) => sprint.id === event.container.id
				)
			});
			transferArrayItem(
				event.previousContainer.data,
				event.container.data,
				event.previousIndex,
				event.currentIndex
			);
		}
	}

	taskAction(evt: { action: string; task: Task }): void {
		switch (evt.action) {
			case 'EDIT_TASK':
				this.editTask(evt.task);
				break;

			case 'DELETE_TASK':
				this.deleteTask(evt.task);
				break;
		}
	}

	changeTaskStatus({ id, status, title }: Partial<Task>): void {
		this.taskStore.editTask({
			id,
			status,
			title
		});
	}

	completeSprint(sprint: OrganizationSprint, evt: any): void {
		this.preventExpand(evt);
		this.store$
			.updateSprint({
				...sprint,
				isActive: false
			})
			.subscribe();
	}

	preventExpand(evt: any): void {
		evt.stopPropagation();
		evt.preventDefault();
	}

	trackByFn(task: Task): string | null {
		return task.id ? task.id : null;
	}
}
