import {
	IOrganizationProject,
	IOrganizationProjectStoreState,
	OrganizationProjectAction
} from '@gauzy/models';
import { Injectable } from '@angular/core';
import { Query, Store as AkitaStore, StoreConfig } from '@datorama/akita';

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'app' })
export class OrganizationProjectAkitaStore extends AkitaStore<IOrganizationProjectStoreState> {
	constructor() {
		super({} as IOrganizationProjectStoreState);
	}
}

@Injectable({ providedIn: 'root' })
export class OrganizationProjectAkitaQuery extends Query<IOrganizationProjectStoreState> {
	constructor(protected store: OrganizationProjectAkitaStore) {
		super(store);
	}
}

/**
 * Service used to update organization project
 */
@Injectable({ providedIn: 'root' })
export class OrganizationProjectStore {
	constructor(
		protected organizationProjectAkitaStore: OrganizationProjectAkitaStore,
		protected organizationProjectAkitaQuery: OrganizationProjectAkitaQuery
	) {}

	organizationProjectAction$ = this.organizationProjectAkitaQuery.select(
		({ projects, action }) => {
			return { projects, action };
		}
	);

	set organizationProjectAction({
		projects,
		action
	}: {
		projects: IOrganizationProject;
		action: OrganizationProjectAction;
	}) {
		this.organizationProjectAkitaStore.update({
			projects: projects,
			action
		});
	}

	clear() {
		localStorage.clear();
	}
}
