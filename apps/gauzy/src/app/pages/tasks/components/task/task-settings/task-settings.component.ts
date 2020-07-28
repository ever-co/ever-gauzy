import { Component } from '@angular/core';
import { Task, OrganizationProjects, TaskListTypeEnum } from '@gauzy/models';
import { uniqWith, isEqual } from 'lodash';
import { Observable } from 'rxjs';
import { map, tap, switchMap, filter, take } from 'rxjs/operators';
import { TasksStoreService } from 'apps/gauzy/src/app/@core/services/tasks-store.service';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';

@Component({
	selector: 'ngx-task-settings',
	templateUrl: './task-settings.component.html',
	styleUrls: ['./task-settings.component.scss']
})
export class TaskSettingsComponent {
	tasks$: Observable<Task[]>;
	projects$: Observable<OrganizationProjects[]>;
	project$: Observable<OrganizationProjects>;

	constructor(
		private _store: TasksStoreService,
		private route: ActivatedRoute,
		private location: Location
	) {
		this.tasks$ = this._store.tasks$;

		this.project$ = this.route.params.pipe(
			switchMap(({ id: currentProjectId }: { id: string }) =>
				this.tasks$.pipe(
					map((tasks: Task[]) => {
						const projectTasks = tasks.filter(
							({ projectId }: Task) =>
								projectId === currentProjectId
						);
						if (!!projectTasks && !!projectTasks.length) {
							return {
								...projectTasks[0].project,
								tasks: projectTasks
							};
						}
						return null;
					})
				)
			)
		);
	}

	changeProject(evt: TaskListTypeEnum): void {
		this.project$
			.pipe(
				tap(({ id }: OrganizationProjects) => {
					this._store.updateTasksViewMode(id, evt);
				}),
				take(1)
			)
			.subscribe();
	}

	goBack(): void {
		this.location.back();
	}
}
