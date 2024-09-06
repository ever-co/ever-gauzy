import { Injectable } from '@angular/core';
import { IOrganizationProject, ProjectOwnerEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { TimeTrackerService } from 'packages/desktop-ui-lib/src/lib/time-tracker/time-tracker.service';
import { SelectorService } from '../../../+state/selector.service';
import { Store, ToastrNotificationService } from '../../../../services';
import { ClientSelectorQuery } from '../../client-selector/+state/client-selector.query';
import { TeamSelectorQuery } from '../../team-selector/+state/team-selector.query';
import { ProjectSelectorQuery } from './project-selector.query';
import { ProjectSelectorStore } from './project-selector.store';

@Injectable({
	providedIn: 'root'
})
export class ProjectSelectorService extends SelectorService<IOrganizationProject> {
	constructor(
		public readonly projectSelectorStore: ProjectSelectorStore,
		public readonly projectSelectorQuery: ProjectSelectorQuery,
		public readonly clientSelectorQuery: ClientSelectorQuery,
		public readonly teamSelectorQuery: TeamSelectorQuery,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly store: Store,
		private readonly toastrNotifier: ToastrNotificationService,
		private readonly translateService: TranslateService
	) {
		super(projectSelectorStore, projectSelectorQuery);
	}

	public get selectedId(): IOrganizationProject['id'] {
		return this.projectSelectorQuery.selectedId;
	}

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

	public async load(): Promise<void> {
		try {
			this.projectSelectorStore.setLoading(true);
			const {
				organizationId,
				tenantId,
				user: {
					employee: { id: employeeId }
				}
			} = this.store;
			const request = {
				organizationId,
				tenantId,
				employeeId,
				organizationContactId: this.clientSelectorQuery.selectedId,
				organizationTeamId: this.teamSelectorQuery.selectedId
			};
			const data = await this.timeTrackerService.getProjects(request);
			this.projectSelectorStore.updateData(data);
			this.projectSelectorStore.setError(null);
		} catch (error) {
			this.toastrNotifier.error(error.message || 'An error occurred while fetching projects.');
			this.projectSelectorStore.setError(error);
		} finally {
			this.projectSelectorStore.setLoading(false);
		}
	}
}
