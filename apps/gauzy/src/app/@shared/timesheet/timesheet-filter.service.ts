import { Injectable } from '@angular/core';
import { Query, Store, StoreConfig } from '@datorama/akita';
import { ITimeLogFilters } from '@gauzy/models';

export function initialTimesheetFilterState(): ITimeLogFilters {
	return {
		employeeIds: [],
		source: [],
		logType: [],
		projectIds: [],
		startDate: new Date(),
		endDate: new Date(),
		date: new Date()
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
	constructor(protected store: TimesheetFilterStore) {
		super(store);
	}
}

@Injectable({
	providedIn: 'root'
})
export class TimesheetFilterService {
	constructor(
		protected timesheetFilterStore: TimesheetFilterStore,
		protected timesheetFilterQuery: TimesheetFilterQuery
	) {}

	filter$ = this.timesheetFilterQuery.select((state) => state);

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
