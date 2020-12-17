import {
	IOrganization,
	OrganizationAction,
	IOrganizationStoreState
} from '@gauzy/models';
import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';
import { Query, Store as AkitaStore, StoreConfig } from '@datorama/akita';

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'app' })
export class OrganizationStore extends AkitaStore<IOrganizationStoreState> {
	constructor() {
		super({} as IOrganizationStoreState);
	}
}

@Injectable({ providedIn: 'root' })
export class OrganizationQuery extends Query<IOrganizationStoreState> {
	constructor(protected store: OrganizationStore) {
		super(store);
	}
}

/**
 * Service used to update organization
 */
@Injectable({ providedIn: 'root' })
export class OrganizationEditStore {
	private _selectedOrganization: IOrganization;

	constructor(
		protected organizationStore: OrganizationStore,
		protected organizationQuery: OrganizationQuery
	) {}

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

	organizationAction$ = this.organizationQuery.select(
		({ organization, action }) => {
			return { organization, action };
		}
	);

	set organizationAction({
		organization,
		action
	}: {
		organization: IOrganization;
		action: OrganizationAction;
	}) {
		this.organizationStore.update({
			organization: organization,
			action
		});
	}

	clear() {
		localStorage.clear();
	}
}
