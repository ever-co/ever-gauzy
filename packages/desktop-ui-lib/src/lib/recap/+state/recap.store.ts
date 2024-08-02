import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import {
	IActivitiesStatistics,
	ICountsStatistics,
	IDailyActivity,
	IProjectsStatistics,
	ITasksStatistics,
	ITimeSlot
} from '@gauzy/contracts';
import { TimeTrackerDateManager } from '../../services';
import { IDateRangePicker } from '../shared/features/date-range-picker/date-picker.interface';

export interface IRecapState {
	range: IDateRangePicker;
	projects: IProjectsStatistics[];
	tasks: ITasksStatistics[];
	activities: IActivitiesStatistics[];
	timeSlots: ITimeSlot[];
	count: ICountsStatistics;
	dailyActivities: IDailyActivity[];
}

export function createInitialState(): IRecapState {
	return {
		projects: [],
		tasks: [],
		activities: [],
		timeSlots: [],
		dailyActivities: [],
		range: {
			startDate: TimeTrackerDateManager.startToday,
			endDate: TimeTrackerDateManager.endToday
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

@StoreConfig({ name: '_recap' })
@Injectable({ providedIn: 'root' })
export class RecapStore extends Store<IRecapState> {
	constructor() {
		super(createInitialState());
	}
}
