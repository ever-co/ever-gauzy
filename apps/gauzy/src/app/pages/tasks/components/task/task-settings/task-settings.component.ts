import { Component } from '@angular/core';
import { Task, OrganizationProjects } from '@gauzy/models';

import { uniqWith, isEqual } from 'lodash';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { TasksStoreService } from 'apps/gauzy/src/app/@core/services/tasks-store.service';

@Component({
	selector: 'ngx-task-settings',
	templateUrl: './task-settings.component.html',
	styleUrls: ['./task-settings.component.scss']
})
export class TaskSettingsComponent {
	tasks$: Observable<Task[]>;
	projects$: Observable<OrganizationProjects[]>;

	constructor(private _store: TasksStoreService) {
		this.tasks$ = this._store.tasks$;
		this.projects$ = this.tasks$.pipe(
			map((tasks: Task[]) => {
				return uniqWith(
					tasks.map((task: Task) => task.project),
					isEqual
				);
			})
		);
	}
}
