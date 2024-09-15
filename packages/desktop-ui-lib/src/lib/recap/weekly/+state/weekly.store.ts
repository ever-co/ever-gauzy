import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ICountsStatistics, ReportDayData } from '@gauzy/contracts';
import { TimeTrackerDateManager } from '../../../services';
import { IDateRangePicker } from '../../shared/features/date-range-picker/date-picker.interface';

export interface IWeeklyRecapState {
	count: ICountsStatistics & { reWeeklyLimit: number };
	range: IDateRangePicker;
	weeklyActivities: ReportDayData[];
}

export function createInitialState(): IWeeklyRecapState {
	return {
		weeklyActivities: [],
		range: {
			startDate: TimeTrackerDateManager.startCurrentWeek,
			endDate: TimeTrackerDateManager.endCurrentWeek
		},
		count: {
			reWeeklyLimit: 0,
			projectsCount: 0,
			employeesCount: 0,
			weekActivities: 0,
			weekDuration: 0,
			todayActivities: 0,
			todayDuration: 0
		}
	};
}

@StoreConfig({ name: '_weeklyRecap' })
@Injectable({ providedIn: 'root' })
export class WeeklyRecapStore extends Store<IWeeklyRecapState> {
	constructor() {
		super(createInitialState());
	}
}
