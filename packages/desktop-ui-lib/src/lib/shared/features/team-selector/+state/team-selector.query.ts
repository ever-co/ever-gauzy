import { Injectable } from '@angular/core';
import { IOrganizationTeam } from '@gauzy/contracts';
import { filter, map, Observable, startWith } from 'rxjs';
import { SelectorQuery } from '../../../+state/selector.query';
import { TeamSelectorStore } from './team-selector.store';

@Injectable({ providedIn: 'root' })
export class TeamSelectorQuery extends SelectorQuery<IOrganizationTeam> {
	constructor(protected store: TeamSelectorStore) {
		super(store);
	}

	public get selectedId(): IOrganizationTeam['id'] {
		return this.selected?.id ?? null;
	}

	public get selectedId$(): Observable<IOrganizationTeam['id']> {
		return this.selected$.pipe(
			filter(Boolean),
			map(({ id }) => id),
			startWith(null)
		);
	}
}
