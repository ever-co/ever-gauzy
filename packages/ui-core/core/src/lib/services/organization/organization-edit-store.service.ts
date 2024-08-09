import { IOrganization, IOrganizationFindInput, IOrganizationStoreState, IOrganizationUpdateInput } from '@gauzy/contracts';
import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';
import { Query, Store as AkitaStore, StoreConfig } from '@datorama/akita';

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'organization', resettable: true })
export class OrganizationStore extends AkitaStore<IOrganizationStoreState> {
	constructor() {
		super({} as IOrganizationStoreState);
	}
}

@Injectable({ providedIn: 'root' })
export class OrganizationQuery extends Query<IOrganizationStoreState> {
	constructor(store: OrganizationStore) {
		super(store);
	}
}

/**
 * Service used to update organization
 */
@Injectable({ providedIn: 'root' })
export class OrganizationEditStore {
	private _selectedOrganization: IOrganization;
	private _organizationForm: IOrganizationFindInput;

	constructor(protected organizationStore: OrganizationStore, protected organizationQuery: OrganizationQuery) { }

	selectedOrganization$: BehaviorSubject<IOrganization> = new BehaviorSubject(this.selectedOrganization);

	organizationForm$: BehaviorSubject<IOrganizationFindInput> = new BehaviorSubject(this.organizationForm);

	set selectedOrganization(organization: IOrganization) {
		this._selectedOrganization = organization;
		this.selectedOrganization$.next(organization);
	}

	get selectedOrganization(): IOrganization {
		return this._selectedOrganization;
	}

	set organizationForm(organization: IOrganizationUpdateInput) {
		this._organizationForm = organization;
		this.organizationForm$.next(organization);
	}

	get organizationForm(): Partial<IOrganizationUpdateInput> {
		return this._organizationForm;
	}

	organizationAction$ = this.organizationQuery.select(({ organization, action }) => {
		return { organization, action };
	});

	set organizationAction({ organization, action }: IOrganizationStoreState) {
		this.organizationStore.update({
			organization,
			action
		});
	}

	/**
	 * Update the organization form with new data
	 *
	 * @param formData - The form data to update.
	 */

	async updateOrganizationForm(formData: Partial<IOrganizationUpdateInput>) {
		this.organizationForm = { ...this.organizationForm, ...formData } as IOrganizationUpdateInput;;
	}

	destroy() {
		this.organizationStore.reset();
	}
}
