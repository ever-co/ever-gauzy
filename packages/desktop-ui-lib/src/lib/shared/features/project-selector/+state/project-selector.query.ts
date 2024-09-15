import { Injectable } from '@angular/core';
import { IOrganizationProject } from '@gauzy/contracts';
import { filter, map, Observable, startWith } from 'rxjs';
import { SelectorQuery } from '../../../+state/selector.query';
import { ProjectSelectorStore } from './project-selector.store';

@Injectable({ providedIn: 'root' })
export class ProjectSelectorQuery extends SelectorQuery<IOrganizationProject> {
	constructor(protected store: ProjectSelectorStore) {
		super(store);
	}

	public get selectedId(): IOrganizationProject['id'] {
		return this.selected?.id ?? null;
	}

	public get selectedId$(): Observable<IOrganizationProject['id']> {
		return this.selected$.pipe(
			filter(Boolean),
			map(({ id }) => id),
			startWith(null)
		);
	}
}
