import { Component } from '@angular/core';
import { Task, OrganizationProjects } from '@gauzy/models';
import { uniqWith, isEqual } from 'lodash';
import { Observable } from 'rxjs';
import { map, tap, switchMap, filter } from 'rxjs/operators';
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

	goBack(): void {
		this.location.back();
	}
}
