import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	IGetTimeSlotStatistics,
	IGetActivitiesStatistics,
	IGetProjectsStatistics,
	IGetMembersStatistics,
	IGetTasksStatistics,
	IGetCountsStatistics,
	ICountsStatistics,
	IMembersStatistics,
	IActivitiesStatistics,
	ITimeSlotStatistics,
	IProjectsStatistics,
	ITasksStatistics,
	IManualTimesStatistics
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class TimesheetStatisticsService {
	constructor(private http: HttpClient) {}

	getCounts(request: IGetCountsStatistics) {
		return firstValueFrom(
			this.http.get<ICountsStatistics>(`${API_PREFIX}/timesheet/statistics/counts`, {
				params: toParams(request)
			})
		);
	}

	getTimeSlots(request?: IGetTimeSlotStatistics) {
		return firstValueFrom(
			this.http.get<ITimeSlotStatistics[]>(`${API_PREFIX}/timesheet/statistics/time-slots`, {
				params: toParams(request)
			})
		);
	}

	getActivities(request?: IGetActivitiesStatistics) {
		return firstValueFrom(
			this.http.get<IActivitiesStatistics[]>(`${API_PREFIX}/timesheet/statistics/activities`, {
				params: toParams(request)
			})
		);
	}

	getTasks(request: IGetTasksStatistics) {
		return firstValueFrom(
			this.http.get<ITasksStatistics[]>(`${API_PREFIX}/timesheet/statistics/tasks`, {
				params: toParams(request)
			})
		);
	}

	getManualTimes(request: any) {
		return firstValueFrom(
			this.http.get<IManualTimesStatistics[]>(`${API_PREFIX}/timesheet/statistics/manual-times`, {
				params: toParams(request)
			})
		);
	}

	getProjects(request?: IGetProjectsStatistics) {
		return firstValueFrom(
			this.http.get<IProjectsStatistics[]>(`${API_PREFIX}/timesheet/statistics/projects`, {
				params: toParams(request)
			})
		);
	}

	getMembers(request: IGetMembersStatistics) {
		return firstValueFrom(
			this.http.get<IMembersStatistics[]>(`${API_PREFIX}/timesheet/statistics/members`, {
				params: toParams(request)
			})
		);
	}
}
