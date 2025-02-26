import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, fromEvent, map, Observable } from 'rxjs';
import { TimeTrackerQuery } from '../../+state/time-tracker.query';
import { SearchTermQuery } from './+state/search-term.query';
import { SearchTermStore } from './+state/search-term.store';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-search',
    templateUrl: './search.component.html',
    styleUrls: ['./search.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
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
				map((event: any) => event.target.value),
				distinctUntilChange(),
				debounceTime(300),
				filter((term) => term !== this.searchTermQuery.value),
				untilDestroyed(this)
			)
			.subscribe((searchTerm: string) => {
				this.onSearch(searchTerm);
			});
	}
}
