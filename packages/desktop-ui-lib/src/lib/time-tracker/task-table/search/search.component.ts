import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Observable } from 'rxjs';
import { TimeTrackerQuery } from '../../+state/time-tracker.query';
import { SearchTermQuery } from './+state/search-term.query';
import { SearchTermStore } from './+state/search-term.store';

@Component({
	selector: 'ngx-search',
	templateUrl: './search.component.html',
	styleUrls: ['./search.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchComponent {
	constructor(
		private readonly searchTermStore: SearchTermStore,
		private readonly searchTermQuery: SearchTermQuery,
		private readonly timeTrackerQuery: TimeTrackerQuery
	) {}
	public onSearch(searchTerm: string) {
		this.searchTermStore.update({ value: searchTerm });
	}

	public get searchTerm$(): Observable<string> {
		return this.searchTermQuery.value$;
	}

	public get disabled$(): Observable<Boolean> {
		return this.timeTrackerQuery.disabled$;
	}
}
