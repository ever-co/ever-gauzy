import { Organization } from '@gauzy/models';
import { BehaviorSubject } from 'rxjs';

/**
 * Service used to update organization
 */
export class OrganizationEditStore {
	private _selectedOrganization: Organization;

	selectedOrganization$: BehaviorSubject<Organization> = new BehaviorSubject(
		this.selectedOrganization
	);

	set selectedOrganization(organization: Organization) {
		this._selectedOrganization = organization;
		this.selectedOrganization$.next(organization);
	}

	get selectedOrganization(): Organization {
		return this._selectedOrganization;
	}

	clear() {
		localStorage.clear();
	}
}
