import { Component, Input } from '@angular/core';

import * as moment from 'moment';
import { Observable } from 'rxjs';

import { OrganizationSprint, OrganizationProjects } from '@gauzy/models';
import { SprintStoreService } from './services/sprint-store.service';
import { ItemActionType } from 'apps/gauzy/src/app/@shared/components/editable-grid/gauzy-editable-grid.component';
import { SprintService } from 'apps/gauzy/src/app/@core/services/organization-sprint.service';

@Component({
	selector: 'ngx-tasks-sprint-settings-view',
	templateUrl: './tasks-sprint-settings-view.component.html',
	styleUrls: ['./tasks-sprint-settings-view.component.css']
})
export class TasksSprintSettingsViewComponent {
	@Input() project: OrganizationProjects;
	sprints$: Observable<OrganizationSprint[]> = this.store.sprints$;
	moment: any = moment;

	constructor(
		private store: SprintStoreService,
		private sprintService: SprintService
	) {}

	sprintAction({
		actionType,
		data
	}: {
		actionType: ItemActionType;
		data: OrganizationSprint;
	}): void {
		switch (actionType) {
			case 'create':
				const createSprintInput: OrganizationSprint = {
					...data,
					organizationId: this.project.organizationId,
					projectId: this.project.id
				};
				this.sprintService.createSprint(createSprintInput).subscribe();
				break;

			case 'edit':
				this.store.updateSprint(data);
				break;

			case 'delete':
				this.store.deleteSprint(data.id);
				break;
		}
	}
}
