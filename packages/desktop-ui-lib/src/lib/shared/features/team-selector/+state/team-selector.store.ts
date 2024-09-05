import { Injectable } from '@angular/core';
import { StoreConfig } from '@datorama/akita';
import { IOrganizationTeam } from '@gauzy/contracts';
import { SelectorStore } from '../../../+state/selector.store';
import { ISelector } from '../../../interfaces/selector.interface';

export type ITeamSelectorState = ISelector<IOrganizationTeam>;

export function createInitialState(): ITeamSelectorState {
	return {
		selected: null,
		data: []
	};
}

@StoreConfig({ name: '_teamSelector' })
@Injectable({ providedIn: 'root' })
export class TeamSelectorStore extends SelectorStore<IOrganizationTeam> {
	constructor() {
		super(createInitialState());
	}
}
