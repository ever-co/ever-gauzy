import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ICountsStatistics, ReportDayData } from '@gauzy/contracts';
import { TimeTrackerDateManager } from '../../../services';
import { IDateRangePicker } from '../../shared/features/date-range-picker/date-picker.interface';

export interface IMonthlyRecapState {
	count: ICountsStatistics;
	range: IDateRangePicker;
	monthlyActivities: ReportDayData[];
}

export function createInitialState(): IMonthlyRecapState {
	return {
		monthlyActivities: [],
		range: {
			startDate: TimeTrackerDateManager.startCurrentMonth,
			endDate: TimeTrackerDateManager.endCurrentMonth
		},
		count: {
			projectsCount: 0,
			employeesCount: 0,
			weekActivities: 0,
			weekDuration: 0,
			todayActivities: 0,
			todayDuration: 0
		}
	};
}

@StoreConfig({ name: '_monthlyRecap' })
@Injectable({ providedIn: 'root' })
export class MonthlyRecapStore extends Store<IMonthlyRecapState> {
	constructor() {
		super(createInitialState());
	}
}
