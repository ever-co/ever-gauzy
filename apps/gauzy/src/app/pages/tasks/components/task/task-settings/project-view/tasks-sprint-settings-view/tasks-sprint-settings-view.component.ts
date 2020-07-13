import { Component, OnInit } from '@angular/core';

import * as moment from 'moment';
import { Observable } from 'rxjs';

import { OrganizationSprint } from '@gauzy/models';
import { SprintStoreService } from './services/sprint-store.service';
import { ItemActionType } from 'apps/gauzy/src/app/@shared/components/editable-grid/gauzy-editable-grid.component';

@Component({
	selector: 'ngx-tasks-sprint-settings-view',
	templateUrl: './tasks-sprint-settings-view.component.html',
	styleUrls: ['./tasks-sprint-settings-view.component.css']
})
export class TasksSprintSettingsViewComponent {
	sprints$: Observable<OrganizationSprint[]> = this.store.sprints$;
	moment: any = moment;

	constructor(private store: SprintStoreService) {}

	sprintAction({
		actionType,
		data
	}: {
		actionType: ItemActionType;
		data: OrganizationSprint;
	}): void {
		switch (actionType) {
			case 'create':
				this.store.createSprint(data);
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
