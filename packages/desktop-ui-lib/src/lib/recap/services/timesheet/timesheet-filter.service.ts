import { Injectable } from '@angular/core';
import { Query, Store, StoreConfig } from '@datorama/akita';
import { ITimeLogFilters } from '@gauzy/contracts';
import { Observable } from 'rxjs';

export const ActivityLevel = {
	start: 0,
	end: 100
};

export function initialTimesheetFilterState(): ITimeLogFilters {
	return {
		activityLevel: ActivityLevel,
		source: [],
		logType: []
	};
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'timesheet-filter', resettable: true })
export class TimesheetFilterStore extends Store<ITimeLogFilters> {
	constructor() {
		super(initialTimesheetFilterState());
	}
}

@Injectable({ providedIn: 'root' })
export class TimesheetFilterQuery extends Query<ITimeLogFilters> {
	public filter$: Observable<ITimeLogFilters> = this.select((state) => state);
	constructor(store: TimesheetFilterStore) {
		super(store);
	}
}

@Injectable({
	providedIn: 'root'
})
export class TimesheetFilterService {
	constructor(
		protected readonly timesheetFilterStore: TimesheetFilterStore,
		protected readonly timesheetFilterQuery: TimesheetFilterQuery
	) {}

	public get filter$(): Observable<ITimeLogFilters> {
		return this.timesheetFilterQuery.filter$;
	}

	public get filter(): ITimeLogFilters {
		return this.timesheetFilterQuery.getValue();
	}
	public set filter(value: ITimeLogFilters) {
		this.timesheetFilterStore.update(value);
	}

	clear() {
		const obj = initialTimesheetFilterState();
		this.timesheetFilterStore.update(obj);
		return obj;
	}
}
