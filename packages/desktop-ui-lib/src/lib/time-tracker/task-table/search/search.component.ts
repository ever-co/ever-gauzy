import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, fromEvent, map, Observable } from 'rxjs';
import { TimeTrackerQuery } from '../../+state/time-tracker.query';
import { SearchTermQuery } from './+state/search-term.query';
import { SearchTermStore } from './+state/search-term.store';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-search',
	templateUrl: './search.component.html',
	styleUrls: ['./search.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchComponent implements AfterViewInit {
	@ViewChild('search') search!: ElementRef;

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

	public get disabled$(): Observable<boolean> {
		return this.timeTrackerQuery.disabled$;
	}

	public get loading$(): Observable<boolean> {
		return this.searchTermQuery.selectLoading();
	}

	ngAfterViewInit() {
		fromEvent(this.search.nativeElement, 'input')
			.pipe(
				// Wait 300ms after the last keystroke before emitting
				debounceTime(300),
				map((event: any) => event.target.value), // Extract the input value
				untilDestroyed(this)
			)
			.subscribe((searchTerm: string) => {
				// Emit the search term
				this.onSearch(searchTerm);
				this.searchTermStore.setLoading(true);
			});
	}
}
