import { IOrganizationProjectStoreState } from '@gauzy/contracts';
import { Injectable } from '@angular/core';
import { Query, Store as AkitaStore, StoreConfig } from '@datorama/akita';

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'project', resettable: true })
export class OrganizationProjectAkitaStore extends AkitaStore<IOrganizationProjectStoreState> {
	constructor() {
		super({} as IOrganizationProjectStoreState);
	}
}

@Injectable({ providedIn: 'root' })
export class OrganizationProjectAkitaQuery extends Query<IOrganizationProjectStoreState> {
	constructor(store: OrganizationProjectAkitaStore) {
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

	organizationProjectAction$ = this.organizationProjectAkitaQuery.select(({ project, action }) => {
		return { project, action };
	});

	set organizationProjectAction({ project, action }: IOrganizationProjectStoreState) {
		this.organizationProjectAkitaStore.update({
			project,
			action
		});
	}

	destroy() {
		this.organizationProjectAkitaStore.reset();
	}
}
