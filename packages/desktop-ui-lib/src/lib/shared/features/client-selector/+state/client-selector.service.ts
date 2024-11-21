import { Injectable } from '@angular/core';
import { ContactType, IOrganizationContact } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { TimeTrackerService } from '../../../../time-tracker/time-tracker.service';
import { SelectorService } from '../../../+state/selector.service';
import { Store, ToastrNotificationService } from '../../../../services';
import { TaskSelectorService } from '../../task-selector/+state/task-selector.service';
import { TeamSelectorService } from '../../team-selector/+state/team-selector.service';
import { ClientSelectorQuery } from './client-selector.query';
import { ClientSelectorStore } from './client-selector.store';

@Injectable({
	providedIn: 'root'
})
export class ClientSelectorService extends SelectorService<IOrganizationContact> {
	constructor(
		public readonly selectorStore: ClientSelectorStore,
		public readonly selectorQuery: ClientSelectorQuery,
		private readonly timeTrackerService: TimeTrackerService,
		public readonly taskSelectorService: TaskSelectorService,
		public readonly teamSelectorService: TeamSelectorService,
		private readonly store: Store,
		private readonly toastrNotifier: ToastrNotificationService,
		private readonly translateService: TranslateService
	) {
		super(selectorStore, selectorQuery);
	}

	public get selectedId(): IOrganizationContact['id'] {
		return this.selectorQuery.selectedId;
	}

	/* Creating a new contact for the organization. */
	public async addContact(name: IOrganizationContact['name']): Promise<void> {
		try {
			this.selectorStore.setLoading(true);
			const { tenantId, organizationId, user } = this.store;
			const member: any = { ...user.employee };
			const payload = {
				name,
				organizationId,
				tenantId,
				contactType: ContactType.CLIENT,
				...(member.id && { members: [member] })
			};
			const contact = await this.timeTrackerService.createNewContact(payload, user);
			this.selectorStore.appendData(contact);
			this.toastrNotifier.success(this.translateService.instant('TIMER_TRACKER.TOASTR.CLIENT_ADDED'));
			this.selectorStore.setError(null);
		} catch (error) {
			console.error('ERROR', error);
			this.selectorStore.setError(error);
		} finally {
			this.selectorStore.setLoading(false);
		}
	}

	public async load(options?: { searchTerm?: string }): Promise<void> {
		try {
			this.selectorStore.setLoading(true);
			const { searchTerm: name } = options || {};
			const {
				organizationId,
				tenantId,
				user: {
					employee: { id: employeeId }
				}
			} = this.store;
			const request = {
				relations: ['projects.members', 'members.user', 'contact'],
				join: {
					alias: 'organization_contact',
					leftJoin: {
						members: 'organization_contact.members'
					}
				},
				where: {
					organizationId,
					tenantId,
					contactType: ContactType.CLIENT,
					members: [employeeId],
					...(name && { name })
				},
				take: this.selectorQuery.limit,
				skip: this.selectorQuery.page
			};
			const { items: data, total } = await this.timeTrackerService.getPaginatedClients(request);
			this.selectorStore.updateInfiniteList({ data, total });
			this.selectorStore.setError(null);
		} catch (error) {
			this.toastrNotifier.error(error.message || 'An error occurred while fetching clients.');
			this.selectorStore.setError(error);
		} finally {
			this.selectorStore.setLoading(false);
		}
	}
}
