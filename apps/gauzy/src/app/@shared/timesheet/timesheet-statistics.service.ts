import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
} from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable({
	providedIn: 'root'
})
export class TimesheetStatisticsService {
	constructor(private http: HttpClient) {}

	getCounts(request: IGetCountsStatistics) {
		const params = toParams(request);
		return this.http
			.get<ICountsStatistics>('/api/timesheet/statistics/counts', {
				params
			})
			.toPromise();
	}

	getTimeSlots(request?: IGetTimeSlotStatistics) {
		const params = toParams(request);
		return this.http
			.get<ITimeSlotStatistics[]>(
				'/api/timesheet/statistics/time-slots',
				{
					params
				}
			)
			.toPromise();
	}

	getActivities(request?: IGetActivitiesStatistics) {
		const params = toParams(request);
		return this.http
			.get<IActivitiesStatistics[]>(
				'/api/timesheet/statistics/activities',
				{ params }
			)
			.toPromise();
	}

	getTasks(request: IGetTasksStatistics) {
		const params = toParams(request);
		return this.http
			.get<ITasksStatistics[]>('/api/timesheet/statistics/tasks', {
				params
			})
			.toPromise();
	}

	getManualTimes(request: any) {
		const params = toParams(request);
		return this.http
			.get<IManualTimesStatistics[]>(
				'/api/timesheet/statistics/manual-times',
				{ params }
			)
			.toPromise();
	}

	getProjects(request?: IGetProjectsStatistics) {
		const params = toParams(request);
		return this.http
			.get<IProjectsStatistics[]>('/api/timesheet/statistics/projects', {
				params
			})
			.toPromise();
	}

	getMembers(request: IGetMembersStatistics) {
		const params = toParams(request);
		return this.http
			.get<IMembersStatistics[]>('/api/timesheet/statistics/members', {
				params
			})
			.toPromise();
	}
}
