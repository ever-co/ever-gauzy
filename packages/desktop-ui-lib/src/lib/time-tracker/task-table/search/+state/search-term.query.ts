import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { ISearchTermState, SearchTermStore } from './search-term.store';

@Injectable({ providedIn: 'root' })
export class SearchTermQuery extends Query<ISearchTermState> {
	public readonly value$: Observable<string> = this.select((state) => state.value);
	constructor(protected store: SearchTermStore) {
		super(store);
	}

	public get value(): string {
		return this.getValue().value;
	}
}
