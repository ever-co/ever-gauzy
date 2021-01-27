import {
	IOrganizationProject,
	IOrganizationProjectStoreState,
	OrganizationProjectAction
} from '@gauzy/contracts';
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
		({ project, action }) => {
			return { project, action };
		}
	);

	set organizationProjectAction({
		project,
		action
	}: {
		project: IOrganizationProject;
		action: OrganizationProjectAction;
	}) {
		this.organizationProjectAkitaStore.update({
			project: project,
			action
		});
	}

	clear() {
		localStorage.clear();
	}
}
