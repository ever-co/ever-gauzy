import { Injectable } from '@angular/core';
import { Query, Store, StoreConfig } from '@datorama/akita';
import { ITimeLogFilters } from '@gauzy/contracts';

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
	constructor(protected readonly store: TimesheetFilterStore) {
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
