import { Component } from '@angular/core';
import { ITask, IOrganizationProject, TaskListTypeEnum } from '@gauzy/models';
import { Observable } from 'rxjs';
import { map, tap, switchMap, take } from 'rxjs/operators';
import { TasksStoreService } from '../../../../../@core/services/tasks-store.service';
import { ActivatedRoute } from '@angular/router';

@Component({
	selector: 'ngx-task-settings',
	templateUrl: './task-settings.component.html',
	styleUrls: ['./task-settings.component.scss']
})
export class TaskSettingsComponent {
	tasks$: Observable<ITask[]>;
	projects$: Observable<IOrganizationProject[]>;
	project$: Observable<IOrganizationProject>;

	constructor(
		private _store: TasksStoreService,
		private route: ActivatedRoute
	) {
		this.tasks$ = this._store.tasks$;

		this.project$ = this.route.params.pipe(
			switchMap(({ id: currentProjectId }: { id: string }) =>
				this.tasks$.pipe(
					map((tasks: ITask[]) => {
						const projectTasks = tasks.filter(
							({ projectId }: ITask) =>
								projectId === currentProjectId
						);
						if (projectTasks.length > 0) {
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
				tap(({ id }: IOrganizationProject) => {
					this._store.updateTasksViewMode(id, evt);
				}),
				take(1)
			)
			.subscribe();
	}
}
