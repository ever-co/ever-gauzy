import { Injectable } from '@angular/core';
import { ID, IOrganizationProject, IOrganizationProjectCreateInput, ProjectOwnerEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { TimeTrackerService } from '../../../../time-tracker/time-tracker.service';
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

	public get selectedId(): ID {
		return this.projectSelectorQuery.selectedId;
	}

	/**
	 * Adds a new project with the specified name.
	 *
	 * @param {IOrganizationProject['name']} name - The name of the project to add.
	 */
	public async addProject(name: IOrganizationProject['name']): Promise<void> {
		this.projectSelectorStore.setLoading(true);
		const { tenantId, user, organizationId } = this.store;

		try {
			// Define the input for creating a new project
			const input: Partial<IOrganizationProjectCreateInput> = {
				name,
				organizationId,
				tenantId,
				owner: ProjectOwnerEnum.CLIENT,
				organizationContactId: this.clientSelectorQuery.selectedId || undefined,
				memberIds: user.employee.id ? [user.employee.id] : []
			};

			// Create the project
			const project = await this.timeTrackerService.createNewProject(input, user);
			// Add the project to the store
			this.projectSelectorStore.appendData(project);
			this.toastrNotifier.success(this.translateService.instant('TIMER_TRACKER.TOASTR.PROJECT_ADDED'));
			this.projectSelectorStore.setError(null);
		} catch (error) {
			console.error(error);
			this.projectSelectorStore.setError(error);
		} finally {
			this.projectSelectorStore.setLoading(false);
		}
	}

	public async load(options?: {
		searchTerm?: string;
		organizationContactId?: string;
		organizationTeamId?: string;
	}): Promise<void> {
		try {
			this.projectSelectorStore.setLoading(true);
			const { searchTerm: name } = options || {};
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
				name,
				organizationContactId: this.clientSelectorQuery.selectedId,
				organizationTeamId: this.teamSelectorQuery.selectedId,
				skip: this.projectSelectorQuery.page,
				take: this.projectSelectorQuery.limit,
				...options
			};
			const { items: data, total } = await this.timeTrackerService.getPaginatedProjects(request);
			this.projectSelectorStore.updateInfiniteList({ data, total });
			this.projectSelectorStore.setError(null);
		} catch (error) {
			this.toastrNotifier.error(error.message || 'An error occurred while fetching projects.');
			this.projectSelectorStore.setError(error);
		} finally {
			this.projectSelectorStore.setLoading(false);
		}
	}
}
