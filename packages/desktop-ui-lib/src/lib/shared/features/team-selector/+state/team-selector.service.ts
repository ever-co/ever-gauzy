import { Injectable } from '@angular/core';
import { IOrganizationTeam } from '@gauzy/contracts';
import { TimeTrackerService } from '../../../../time-tracker/time-tracker.service';
import { SelectorService } from '../../../+state/selector.service';
import { Store, ToastrNotificationService } from '../../../../services';
import { ProjectSelectorQuery } from '../../project-selector/+state/project-selector.query';
import { TeamSelectorQuery } from './team-selector.query';
import { TeamSelectorStore } from './team-selector.store';

@Injectable({
	providedIn: 'root'
})
export class TeamSelectorService extends SelectorService<IOrganizationTeam> {
	constructor(
		private readonly teamSelectorStore: TeamSelectorStore,
		private readonly teamSelectorQuery: TeamSelectorQuery,
		private readonly projectSelectorQuery: ProjectSelectorQuery,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly toastrNotifier: ToastrNotificationService,
		private readonly store: Store
	) {
		super(teamSelectorStore, teamSelectorQuery);
	}

	public get selectedId(): IOrganizationTeam['id'] {
		return this.teamSelectorQuery.selectedId;
	}

	public async load(options?: { searchTerm?: string; projectId?: string }): Promise<void> {
		try {
			this.teamSelectorStore.setLoading(true);
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
				projectId: this.projectSelectorQuery.selectedId,
				take: this.teamSelectorQuery.limit,
				skip: this.teamSelectorQuery.page,
				...options
			};
			const { items: data, total } = await this.timeTrackerService.getPaginatedTeams(request);
			this.teamSelectorStore.updateInfiniteList({ data, total });
			this.teamSelectorStore.setError(null);
		} catch (error) {
			this.toastrNotifier.error(error.message || 'An error occurred while fetching teams.');
			this.teamSelectorStore.setError(error);
		} finally {
			this.teamSelectorStore.setLoading(false);
		}
	}
}
