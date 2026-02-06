import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ITimeLogFilters } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { RequestQuery } from '../../+state/request/request.query';
import { RequestStore } from '../../+state/request/request.store';
import { NbButtonModule, NbPopoverModule, NbIconModule } from '@nebular/theme';
import { GauzyFiltersComponent } from '../../shared/features/gauzy-filters/gauzy-filters.component';
import { AutoRefreshComponent } from '../../shared/ui/auto-refresh/auto-refresh.component';
import { AsyncPipe } from '@angular/common';

@Component({
    selector: 'ngx-filter',
    templateUrl: './filter.component.html',
    styleUrls: ['./filter.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NbButtonModule, NbPopoverModule, NbIconModule, GauzyFiltersComponent, AutoRefreshComponent, AsyncPipe]
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
