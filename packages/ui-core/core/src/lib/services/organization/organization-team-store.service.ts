import { IOrganizationTeamStoreState } from '@gauzy/contracts';
import { Injectable } from '@angular/core';
import { Query, Store as AkitaStore, StoreConfig } from '@datorama/akita';

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'team', resettable: true })
export class OrganizationTeamAkitaStore extends AkitaStore<IOrganizationTeamStoreState> {
	constructor() {
		super({} as IOrganizationTeamStoreState);
	}
}

@Injectable({ providedIn: 'root' })
export class OrganizationTeamAkitaQuery extends Query<IOrganizationTeamStoreState> {
	constructor(store: OrganizationTeamAkitaStore) {
		super(store);
	}
}

/**
 * Service used to update organization Team
 */
@Injectable({ providedIn: 'root' })
export class OrganizationTeamStore {
	constructor(
		protected organizationTeamAkitaStore: OrganizationTeamAkitaStore,
		protected OrganizationTeamAkitaQuery: OrganizationTeamAkitaQuery
	) {}

	organizationTeamAction$ = this.OrganizationTeamAkitaQuery.select(({ team, action }) => {
		return { team, action };
	});

	set organizationTeamAction({ team, action }: IOrganizationTeamStoreState) {
		this.organizationTeamAkitaStore.update({
			team,
			action
		});
	}

	destroy() {
		this.organizationTeamAkitaStore.reset();
	}
}
