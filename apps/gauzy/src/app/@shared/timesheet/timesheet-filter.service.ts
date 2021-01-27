import { Injectable } from '@angular/core';
import { Query, Store, StoreConfig } from '@datorama/akita';
import { ITimeLogFilters } from '@gauzy/contracts';
import * as moment from 'moment';

export const ActivityLevel = {
	start: 0,
	end: 100
};

export function initialTimesheetFilterState(): ITimeLogFilters {
	return {
		activityLevel: ActivityLevel,
		employeeIds: [],
		source: [],
		logType: [],
		projectIds: [],
		startDate: new Date(
			moment().startOf('day').format('YYYY-MM-DD HH:mm:ss')
		),
		endDate: new Date(moment().endOf('day').format('YYYY-MM-DD HH:mm:ss')),
		date: new Date(moment().startOf('day').format('YYYY-MM-DD HH:mm:ss'))
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
