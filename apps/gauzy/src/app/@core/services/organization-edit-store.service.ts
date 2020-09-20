import { IOrganization } from '@gauzy/models';
import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';

/**
 * Service used to update organization
 */
@Injectable()
export class OrganizationEditStore {
	private _selectedOrganization: IOrganization;

	selectedOrganization$: BehaviorSubject<IOrganization> = new BehaviorSubject(
		this.selectedOrganization
	);

	set selectedOrganization(organization: IOrganization) {
		this._selectedOrganization = organization;
		this.selectedOrganization$.next(organization);
	}

	get selectedOrganization(): IOrganization {
		return this._selectedOrganization;
	}

	clear() {
		localStorage.clear();
	}
}
