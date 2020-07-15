import { Component, OnInit, Input } from '@angular/core';
import { SprintStoreService } from 'apps/gauzy/src/app/@core/services/organization-sprint-store.service';
import { Task, OrganizationSprint, OrganizationProjects } from '@gauzy/models';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import {
	CdkDragDrop,
	moveItemInArray,
	transferArrayItem
} from '@angular/cdk/drag-drop';

declare const window;
@Component({
	selector: 'ga-tasks-sprint-view',
	templateUrl: './tasks-sprint-view.component.html',
	styleUrls: ['./tasks-sprint-view.component.scss']
})
export class TasksSprintViewComponent implements OnInit {
	@Input() project: OrganizationProjects;
	@Input() tasks: Task[];
	sprints$: Observable<OrganizationSprint[]> = this.store$.sprints$.pipe(
		map((sprints: OrganizationSprint[]): OrganizationSprint[] =>
			sprints.filter(
				(sprint: OrganizationSprint) =>
					sprint.projectId === this.project.id
			)
		),
		tap((sprints: OrganizationSprint[]) =>
			sprints.forEach((sprint: OrganizationSprint) =>
				this.sprintIds.push(sprint.id)
			)
		)
	);

	sprintIds: string[] = [];

	constructor(private store$: SprintStoreService) {}

	ngOnInit(): void {
		console.log('TASKS: ', this.tasks);
		this.sprints$.subscribe((sprints) => console.log('SPRINTS: ', sprints));
		window.t = this;
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
			transferArrayItem(
				event.previousContainer.data,
				event.container.data,
				event.previousIndex,
				event.currentIndex
			);
		}
	}
}
