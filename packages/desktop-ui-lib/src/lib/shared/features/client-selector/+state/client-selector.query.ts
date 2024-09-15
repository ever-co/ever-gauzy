import { Injectable } from '@angular/core';
import { IOrganizationContact } from '@gauzy/contracts';
import { map, Observable, startWith } from 'rxjs';
import { filter } from 'rxjs/operators';
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
		return this.selected$.pipe(
			filter(Boolean),
			map(({ id }) => id),
			startWith(null)
		);
	}
}
