import { Injectable } from '@angular/core';
import { StoreConfig } from '@datorama/akita';
import { IOrganizationProject } from '@gauzy/contracts';
import { SelectorStore } from '../../../+state/selector.store';
import { ISelector } from '../../../interfaces/selector.interface';

export type IProjectSelectorState = ISelector<IOrganizationProject>;

export function createInitialState(): IProjectSelectorState {
	return {
		hasPermission: false,
		selected: null,
		data: [],
		total: 0,
		page: 1,
		limit: 10
	};
}

@StoreConfig({ name: '_projectSelector' })
@Injectable({ providedIn: 'root' })
export class ProjectSelectorStore extends SelectorStore<IOrganizationProject> {
	constructor() {
		super(createInitialState());
	}
}
