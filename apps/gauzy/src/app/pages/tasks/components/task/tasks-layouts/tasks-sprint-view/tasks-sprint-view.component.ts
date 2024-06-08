import { Component, OnInit, Input, Output, EventEmitter, SimpleChanges, OnChanges } from '@angular/core';
import { ITask, IOrganizationSprint, IOrganizationProject, IOrganization } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { map, tap, filter, take } from 'rxjs/operators';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { SprintStoreService, TasksStoreService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';
import { GauzyEditableGridComponent } from '../../../../../../@shared/components/editable-grid/gauzy-editable-grid.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-tasks-sprint-view',
	templateUrl: './tasks-sprint-view.component.html',
	styleUrls: ['./tasks-sprint-view.component.scss']
})
export class TasksSprintViewComponent extends GauzyEditableGridComponent<ITask> implements OnInit, OnChanges {
	sprints: IOrganizationSprint[] = [];
	backlogTasks: ITask[] = [];

	@Input() tasks: ITask[] = [];
	@Input() project: IOrganizationProject;

	@Output() createTaskEvent: EventEmitter<any> = new EventEmitter();
	@Output() editTaskEvent: EventEmitter<any> = new EventEmitter();
	@Output() deleteTaskEvent: EventEmitter<any> = new EventEmitter();
	@Output() selectedTaskEvent: EventEmitter<any> = new EventEmitter();

	sprints$: Observable<IOrganizationSprint[]> = this.store$.sprints$.pipe(
		map((sprints: IOrganizationSprint[]): IOrganizationSprint[] =>
			sprints.filter((sprint: IOrganizationSprint) => sprint.projectId === this.project.id)
		),
		tap((sprints: IOrganizationSprint[]) => {
			this.sprintIds = [...sprints.map((sprint: IOrganizationSprint) => sprint.id), 'backlog'];
		})
	);

	sprintIds: string[] = [];
	sprintActions: { title: string }[] = [];
	organizationId: string;
	selectedTask: ITask;
	isSelected: boolean = false;
	@Input() sync: boolean = false;

	constructor(
		private readonly store$: SprintStoreService,
		translateService: TranslateService,
		dialogService: NbDialogService,
		private readonly taskStore: TasksStoreService,
		private readonly storeService: Store
	) {
		super(translateService, dialogService);
	}

	ngOnInit(): void {
		this.backlogTasks = this.tasks;
		this.sprintActions = [
			{ title: this.getTranslation('TASKS_PAGE.EDIT_SPRINT') },
			{ title: this.getTranslation('TASKS_PAGE.DELETE_SPRINT') }
		];
	}

	initOrganization(project: IOrganizationProject) {
		this.storeService.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization: IOrganization) => {
					const { tenantId } = this.storeService.user;
					const { id: organizationId } = organization;
					this.organizationId = organizationId;
					this.store$.fetchSprints({
						organizationId,
						projectId: project.id,
						tenantId
					});
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	reduceTasks(tasks: ITask[]): void {
		this.sprints$.pipe(untilDestroyed(this)).subscribe((availableSprints: IOrganizationSprint[]) => {
			const sprints = availableSprints.reduce(
				(acc: { [key: string]: IOrganizationSprint }, sprint: IOrganizationSprint) => {
					acc[sprint.id] = {
						...sprint,
						tasks: sprint.tasks || []
					};
					return acc;
				},
				{}
			);
			this.sprints = Object.values(sprints);

			const backlog = [];
			tasks.forEach((task) => {
				if (!task.organizationSprint) {
					backlog.push(task);
				}
			});
			this.backlogTasks = backlog;
		});
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes.tasks) {
			this.reduceTasks(changes.tasks.currentValue);
		}

		if (changes.project) {
			this.initOrganization(changes.project.currentValue);
		}
	}

	createTask(): void {
		this.createTaskEvent.emit();
	}

	editTask(selectedItem: ITask): void {
		this.selectedTaskEvent.emit(this.selectedItem || selectedItem);
	}

	deleteTask(selectedItem: ITask): void {
		this.deleteTaskEvent.emit(selectedItem);
	}

	toggleItemSelection(task: ITask) {
		this.isSelected = this.isSelected && task === this.selectedTask ? !this.isSelected : true;
		this.selectedTask = task === this.selectedTask ? null : task;
		this.selectedTaskEvent.emit({
			data: task,
			isSelected: this.isSelected
		});
	}

	drop(event: CdkDragDrop<string[]>) {
		if (event.previousContainer === event.container) {
			moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
		} else {
			this.taskStore
				.editTask({
					id: event.item.data.id,
					title: event.item.data.title,
					organizationSprint: this.sprints.find((sprint) => sprint.id === event.container.id) || null
				})
				.pipe(untilDestroyed(this))
				.subscribe();
			transferArrayItem(
				event.previousContainer.data,
				event.container.data,
				event.previousIndex,
				event.currentIndex
			);
		}
	}

	taskAction(evt: { action: string; task: ITask }): void {
		switch (evt.action) {
			case 'EDIT_TASK':
				this.editTask(evt.task);
				break;

			case 'DELETE_TASK':
				this.deleteTask(evt.task);
				break;
		}
	}

	changeTaskStatus({ id, taskStatus, status, title }: Partial<ITask>): void {
		this.taskStore
			.editTask({
				id,
				status,
				title,
				organizationId: this.organizationId,
				taskStatus
			})
			.pipe(untilDestroyed(this))
			.subscribe();
	}

	completeSprint(sprint: IOrganizationSprint, evt: any): void {
		this.preventExpand(evt);
		this.store$
			.updateSprint({
				...sprint,
				isActive: false
			})
			.pipe(take(1), untilDestroyed(this))
			.subscribe();
	}

	trackByFn(task: ITask): string | null {
		return task.id ? task.id : null;
	}

	private preventExpand(evt: any): void {
		evt.stopPropagation();
		evt.preventDefault();
	}
}
