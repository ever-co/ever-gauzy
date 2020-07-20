import { Component, Input, OnInit, OnDestroy } from '@angular/core';

import * as moment from 'moment';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

import { OrganizationSprint, OrganizationProjects } from '@gauzy/models';
import { SprintStoreService } from '../../../../../../../@core/services/organization-sprint-store.service';
import { ItemActionType } from 'apps/gauzy/src/app/@shared/components/editable-grid/gauzy-editable-grid.component';

@Component({
	selector: 'ngx-tasks-sprint-settings-view',
	templateUrl: './tasks-sprint-settings-view.component.html'
})
export class TasksSprintSettingsViewComponent implements OnInit, OnDestroy {
	@Input() project: OrganizationProjects;
	sprints$: Observable<OrganizationSprint[]> = this.store.sprints$.pipe(
		map((sprints: OrganizationSprint[]): OrganizationSprint[] =>
			sprints.filter(
				(sprint: OrganizationSprint) =>
					sprint.projectId === this.project.id
			)
		),
		map((sprints: OrganizationSprint[]): OrganizationSprint[] => {
			return sprints.sort((sprint, nextSprint) =>
				sprint.startDate < nextSprint.startDate ? -1 : 1
			);
		})
	);
	moment: any = moment;
	private _onDestroy$: Subject<void> = new Subject<void>();

	constructor(private store: SprintStoreService) {}

	ngOnInit(): void {}

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
				this.store
					.createSprint(createSprintInput)
					.pipe(takeUntil(this._onDestroy$))
					.subscribe();
				break;

			case 'edit':
				this.store
					.updateSprint(data)
					.pipe(takeUntil(this._onDestroy$))
					.subscribe();
				break;

			case 'delete':
				this.store
					.deleteSprint(data.id)
					.pipe(takeUntil(this._onDestroy$))
					.subscribe();
				break;
		}
	}

	ngOnDestroy(): void {
		this._onDestroy$.next();
		this._onDestroy$.complete();
	}
}
