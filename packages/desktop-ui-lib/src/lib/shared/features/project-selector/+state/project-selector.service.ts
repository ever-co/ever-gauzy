import { Injectable } from '@angular/core';
import { IOrganizationProject, ProjectOwnerEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { TimeTrackerService } from 'packages/desktop-ui-lib/src/lib/time-tracker/time-tracker.service';
import { Store, ToastrNotificationService } from '../../../../services';
import { ClientSelectorQuery } from '../../client-selector/+state/client-selector.query';
import { ProjectSelectorQuery } from './project-selector.query';
import { ProjectSelectorStore } from './project-selector.store';

@Injectable({
	providedIn: 'root'
})
export class ProjectSelectorService {
	constructor(
		public readonly projectSelectorStore: ProjectSelectorStore,
		public readonly projectSelectorQuery: ProjectSelectorQuery,
		public readonly clientSelectorQuery: ClientSelectorQuery,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly store: Store,
		private readonly toastrNotifier: ToastrNotificationService,
		private readonly translateService: TranslateService
	) {}

	public async addProject(name: IOrganizationProject['name']): Promise<void> {
		try {
			const { tenantId, user } = this.store;
			const organizationId = this.store.organizationId;
			const request = {
				name,
				organizationId,
				tenantId,
				owner: ProjectOwnerEnum.CLIENT,
				...(this.clientSelectorQuery.selectedId
					? { organizationContactId: this.clientSelectorQuery.selectedId }
					: {})
			};

			request['members'] = [{ ...user.employee }];

			const project = await this.timeTrackerService.createNewProject(request, user);
			this.projectSelectorStore.appendData(project);
			this.toastrNotifier.success(this.translateService.instant('TIMER_TRACKER.TOASTR.PROJECT_ADDED'));
		} catch (error) {
			console.error(error);
		}
	}
}
