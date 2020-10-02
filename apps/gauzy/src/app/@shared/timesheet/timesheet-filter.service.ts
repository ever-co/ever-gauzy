import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Query, resetStores, Store, StoreConfig } from '@datorama/akita';
import { ITimeLogFilters } from '@gauzy/models';

export function createInitialTimesheetFilterState(): ITimeLogFilters {
	let timesheetFilter = {
		employeeIds: [],
		source: [],
		logType: [],
		projectIds: [],
		startDate: new Date(),
		endDate: new Date()
	};
	try {
		const filter = '{}'; // localStorage.getItem('timesheetFilter');
		if (filter) {
			timesheetFilter = {
				...timesheetFilter,
				...JSON.parse(filter)
			};
		}
	} catch (error) {}
	return {
		employeeIds: [],
		source: [],
		logType: [],
		projectIds: [],
		startDate: new Date(),
		endDate: new Date()
	} as ITimeLogFilters;
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'timesheet-filter', resettable: true })
export class TimesheetFilterStore extends Store<ITimeLogFilters> {
	constructor() {
		super(createInitialTimesheetFilterState());
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
		const obj = {
			employeeIds: [],
			source: [],
			logType: [],
			projectIds: [],
			startDate: new Date(),
			endDate: new Date()
		};
		this.timesheetFilterStore.update(obj);
		return obj;
	}
}
