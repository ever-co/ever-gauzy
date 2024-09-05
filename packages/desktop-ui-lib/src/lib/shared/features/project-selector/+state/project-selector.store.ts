import { Injectable } from '@angular/core';
import { StoreConfig } from '@datorama/akita';
import { IOrganizationProject } from '@gauzy/contracts';
import { SelectorStore } from '../../../+state/selector.store';
import { ISelector } from '../../../interfaces/selector.interface';

export type IProjectSelectorState = ISelector<IOrganizationProject>;

export function createInitialState(): IProjectSelectorState {
	return {
		selected: null,
		data: []
	};
}

@StoreConfig({ name: '_projectSelector' })
@Injectable({ providedIn: 'root' })
export class ProjectSelectorStore extends SelectorStore<IOrganizationProject> {
	constructor() {
		super(createInitialState());
	}
}
