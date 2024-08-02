import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ITimeLogFilters } from '@gauzy/contracts';
import { RequestQuery } from '../../+state/request/request.query';
import { RequestStore } from '../../+state/request/request.store';

@Component({
	selector: 'ngx-filter',
	templateUrl: './filter.component.html',
	styleUrls: ['./filter.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterComponent {
	private readonly store = inject(RequestStore);
	private readonly query = inject(RequestQuery);
	public readonly filters = this.query.request;

	public filtersChange(filters: ITimeLogFilters) {
		this.store.update(filters);
	}
}
