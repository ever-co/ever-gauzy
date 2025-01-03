import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ITimeLogFilters } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { RequestQuery } from '../../+state/request/request.query';
import { RequestStore } from '../../+state/request/request.store';

@Component({
    selector: 'ngx-filter',
    templateUrl: './filter.component.html',
    styleUrls: ['./filter.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class FilterComponent {
	constructor(private readonly store: RequestStore, private readonly query: RequestQuery) {}

	public get filters$(): Observable<ITimeLogFilters> {
		return this.query.request$;
	}

	public filtersChange(filters: ITimeLogFilters) {
		this.store.update(filters);
	}
}
