import { Injectable } from '@angular/core';
import { ContactType, IOrganizationContact } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { TimeTrackerService } from 'packages/desktop-ui-lib/src/lib/time-tracker/time-tracker.service';
import { Store, ToastrNotificationService } from '../../../../services';
import { ClientSelectorQuery } from './client-selector.query';
import { ClientSelectorStore } from './client-selector.store';

@Injectable({
	providedIn: 'root'
})
export class ClientSelectorService {
	constructor(
		public readonly selectorStore: ClientSelectorStore,
		public readonly selectorQuery: ClientSelectorQuery,
		private readonly timeTrackerService: TimeTrackerService,
		private readonly store: Store,
		private readonly toastrNotifier: ToastrNotificationService,
		private readonly translateService: TranslateService
	) {}

	/* Creating a new contact for the organization. */
	public async addContact(name: IOrganizationContact['name']): Promise<void> {
		try {
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
		} catch (error) {
			console.error('ERROR', error);
		}
	}
}
