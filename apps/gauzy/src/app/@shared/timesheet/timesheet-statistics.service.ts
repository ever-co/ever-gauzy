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
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../../@core/constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class TimesheetStatisticsService {
	constructor(private http: HttpClient) {}

	getCounts(request: IGetCountsStatistics) {
		const params = toParams(request);
		return this.http
			.get<ICountsStatistics>(
				`${API_PREFIX}/timesheet/statistics/counts`,
				{
					params
				}
			)
			.toPromise();
	}

	getTimeSlots(request?: IGetTimeSlotStatistics) {
		const params = toParams(request);
		return this.http
			.get<ITimeSlotStatistics[]>(
				`${API_PREFIX}/timesheet/statistics/time-slots`,
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
				`${API_PREFIX}/timesheet/statistics/activities`,
				{ params }
			)
			.toPromise();
	}

	getTasks(request: IGetTasksStatistics) {
		const params = toParams(request);
		return this.http
			.get<ITasksStatistics[]>(
				`${API_PREFIX}/timesheet/statistics/tasks`,
				{
					params
				}
			)
			.toPromise();
	}

	getManualTimes(request: any) {
		const params = toParams(request);
		return this.http
			.get<IManualTimesStatistics[]>(
				`${API_PREFIX}/timesheet/statistics/manual-times`,
				{ params }
			)
			.toPromise();
	}

	getProjects(request?: IGetProjectsStatistics) {
		const params = toParams(request);
		return this.http
			.get<IProjectsStatistics[]>(
				`${API_PREFIX}/timesheet/statistics/projects`,
				{
					params
				}
			)
			.toPromise();
	}

	getMembers(request: IGetMembersStatistics) {
		const params = toParams(request);
		return this.http
			.get<IMembersStatistics[]>(
				`${API_PREFIX}/timesheet/statistics/members`,
				{
					params
				}
			)
			.toPromise();
	}
}
