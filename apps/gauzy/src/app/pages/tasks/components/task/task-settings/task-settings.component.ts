import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IOrganizationProject, TaskListTypeEnum, PermissionsEnum, IPagination, ITask } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { map, tap, switchMap, take } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@gauzy/ui-sdk/common';
import { TasksService, TasksStoreService } from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-task-settings',
	templateUrl: './task-settings.component.html',
	styleUrls: ['./task-settings.component.scss']
})
export class TaskSettingsComponent {
	projects$: Observable<IOrganizationProject[]>;
	project$: Observable<IOrganizationProject>;
	PermissionsEnum: typeof PermissionsEnum = PermissionsEnum;

	constructor(
		private readonly _taskStore: TasksStoreService,
		private readonly _route: ActivatedRoute,
		private readonly _taskService: TasksService,
		private readonly _store: Store
	) {
		this.project$ = this._route.params.pipe(
			switchMap(({ id: currentProjectId }: { id: string }) => {
				const { id: organizationId } = this._store.selectedOrganization;
				const { tenantId } = this._store.user;

				return this._taskService
					.getAllTasks(
						{
							organizationId,
							tenantId,
							...(currentProjectId
								? {
										projectId: currentProjectId
								  }
								: {})
						},
						['project']
					)
					.pipe(
						map(({ items, total }: IPagination<ITask>) => {
							const projectTasks = items;
							if (total > 0) {
								return {
									...projectTasks[0].project,
									tasks: projectTasks
								};
							}
							return null;
						}),
						untilDestroyed(this)
					);
			})
		);
	}

	changeProject(evt: TaskListTypeEnum): void {
		this.project$
			.pipe(
				tap(({ id }: IOrganizationProject) => {
					this._taskStore.updateTasksViewMode(id, evt);
				}),
				take(1)
			)
			.subscribe();
	}
}
