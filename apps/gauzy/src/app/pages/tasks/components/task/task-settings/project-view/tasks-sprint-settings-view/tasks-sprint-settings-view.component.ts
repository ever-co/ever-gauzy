import { Component, Input, OnInit, OnDestroy } from '@angular/core';

import * as moment from 'moment';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

import { IOrganizationSprint, IOrganizationProject } from '@gauzy/models';
import { SprintStoreService } from '../../../../../../../@core/services/organization-sprint-store.service';
import { ItemActionType } from '../../../../../../../@shared/components/editable-grid/gauzy-editable-grid.component';

@Component({
	selector: 'ngx-tasks-sprint-settings-view',
	templateUrl: './tasks-sprint-settings-view.component.html'
})
export class TasksSprintSettingsViewComponent implements OnInit, OnDestroy {
	@Input() project: IOrganizationProject;
	sprints$: Observable<IOrganizationSprint[]> = this.store.sprints$.pipe(
		map((sprints: IOrganizationSprint[]): IOrganizationSprint[] =>
			sprints.filter(
				(sprint: IOrganizationSprint) =>
					sprint.projectId === this.project.id
			)
		),
		map((sprints: IOrganizationSprint[]): IOrganizationSprint[] => {
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
		data: IOrganizationSprint;
	}): void {
		switch (actionType) {
			case 'create':
				const createSprintInput: IOrganizationSprint = {
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
