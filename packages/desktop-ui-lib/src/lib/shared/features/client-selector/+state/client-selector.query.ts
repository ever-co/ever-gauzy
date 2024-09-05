import { Injectable } from '@angular/core';
import { IOrganizationContact } from '@gauzy/contracts';
import { map, Observable } from 'rxjs';
import { SelectorQuery } from '../../../+state/selector.query';
import { ClientSelectorStore } from './client-selector.store';

@Injectable({ providedIn: 'root' })
export class ClientSelectorQuery extends SelectorQuery<IOrganizationContact> {
	constructor(protected store: ClientSelectorStore) {
		super(store);
	}

	public get selectedId(): IOrganizationContact['id'] {
		return this.selected?.id ?? null;
	}

	public get selectedId$(): Observable<IOrganizationContact['id']> {
		return this.selected$.pipe(map((selected) => selected?.id ?? null));
	}
}
