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
import { map, tap } from 'rxjs/operators';
import {
	CdkDragDrop,
	moveItemInArray,
	transferArrayItem
} from '@angular/cdk/drag-drop';
import { GauzyEditableGridComponent } from 'apps/gauzy/src/app/@shared/components/editable-grid/gauzy-editable-grid.component';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-tasks-sprint-view',
	templateUrl: './tasks-sprint-view.component.html',
	styleUrls: ['./tasks-sprint-view.component.scss']
})
export class TasksSprintViewComponent extends GauzyEditableGridComponent<Task>
	implements OnInit, OnChanges {
	sprints: OrganizationSprint[] = [];
	@Input() project: OrganizationProjects;
	@Input() private tasks: Task[];
	backlogTasks: Task[] = [];
	@Output() createTaskEvent: EventEmitter<any> = new EventEmitter();
	@Output() editTaskEvent: EventEmitter<any> = new EventEmitter();
	@Output() deleteTaskEvent: EventEmitter<any> = new EventEmitter();
	sprints$: Observable<OrganizationSprint[]> = this.store$.sprints$.pipe(
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

	constructor(
		private store$: SprintStoreService,
		translateService: TranslateService,
		dialogService: NbDialogService
	) {
		super(translateService, dialogService);
	}

	ngOnInit(): void {
		// this.backlogTasks = this.tasks.filter((task) => !task.organizationSprint);
	}

	reduceTasks(tasks: Task[]): void {
		const sprints = {};
		const backlog = [];
		this.tasks.forEach((task) => {
			if (!!task.organizationSprint) {
				if (!sprints[task.organizationSprint.id]) {
					sprints[task.organizationSprint.id] = {
						...task.organizationSprint,
						tasks: []
					};
					sprints[task.organizationSprint.id].tasks.push(task);
				} else {
					sprints[task.organizationSprint.id].tasks.push(task);
				}
			} else {
				backlog.push(task);
			}
		});
		this.sprints = Object.values(sprints);
		this.backlogTasks = backlog;
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (!!changes && !!changes.tasks) {
			this.reduceTasks(changes.tasks.currentValue);
			// this.backlogTasks = this.tasks.filter(
			//   (task) => !task.organizationSprint
			// );
		}
		console.log(changes);
	}

	createTask(): void {
		this.createTaskEvent.emit();
	}

	editTask(selectedItem: Task): void {
		console.log('selectedItem: ', selectedItem);
		console.log('this.selectedItem: ', this.selectedItem);
		this.editTaskEvent.emit(this.selectedItem);
		// this.editTaskEvent.emit(selectedItem);
	}

	deleteTask(selectedItem: Task): void {
		console.log(selectedItem);
		this.deleteTaskEvent.emit(selectedItem);
		// this.editTaskEvent.emit(selectedItem);
	}

	drop(event: CdkDragDrop<string[]>) {
		console.log(event);

		if (event.previousContainer === event.container) {
			moveItemInArray(
				event.container.data,
				event.previousIndex,
				event.currentIndex
			);
		} else {
			this.store$
				.moveTaskToSprint(event.container.id, event.item.data)
				.subscribe(console.log);
			transferArrayItem(
				event.previousContainer.data,
				event.container.data,
				event.previousIndex,
				event.currentIndex
			);
		}
	}

	trackByFn(task: Task): string | null {
		return task.id ? task.id : null;
	}
}
