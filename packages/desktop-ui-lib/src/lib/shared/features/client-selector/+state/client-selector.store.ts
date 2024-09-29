import { Injectable } from '@angular/core';
import { StoreConfig } from '@datorama/akita';
import { IOrganizationContact } from '@gauzy/contracts';
import { SelectorStore } from '../../../+state/selector.store';
import { ISelector } from '../../../interfaces/selector.interface';

export type IClientSelectorState = ISelector<IOrganizationContact>;

export function createInitialState(): IClientSelectorState {
	return {
		hasPermission: false,
		selected: null,
		data: [],
		total: 0,
		page: 1,
		limit: 10
	};
}

@StoreConfig({ name: '_clientSelector' })
@Injectable({ providedIn: 'root' })
export class ClientSelectorStore extends SelectorStore<IOrganizationContact> {
	constructor() {
		super(createInitialState());
	}
}
