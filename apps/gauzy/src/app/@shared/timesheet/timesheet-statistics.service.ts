import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	TimeSlot,
	GetTimeSlotStatistics,
	GetActivitiesStatistics,
	GetProjectsStatistics,
	GetMembersStatistics,
	GetTasksStatistics
} from '@gauzy/models';
import { toParams } from 'libs/utils';

@Injectable({
	providedIn: 'root'
})
export class TimesheetStatisticsService {
	constructor(private http: HttpClient) {}

	getTimeSlots(request?: GetTimeSlotStatistics) {
		const params = toParams(request);
		return this.http
			.get('/api/timesheet/statistics/time-slots', { params })
			.toPromise()
			.then((data: TimeSlot[]) => {
				return data;
			});
	}

	getActivities(request?: GetActivitiesStatistics) {
		const params = toParams(request);
		return this.http
			.get('/api/timesheet/statistics/activities', { params })
			.toPromise()
			.then((data: TimeSlot[]) => {
				return data;
			});
	}

	getTasks(request: GetTasksStatistics) {
		const params = toParams(request);
		return this.http
			.get('/api/timesheet/statistics/tasks', { params })
			.toPromise()
			.then((data: TimeSlot[]) => {
				return data;
			});
	}

	getProjects(request?: GetProjectsStatistics) {
		const params = toParams(request);
		return this.http
			.get('/api/timesheet/statistics/projects', { params })
			.toPromise()
			.then((data: TimeSlot[]) => {
				return data;
			});
	}

	getMembers(request: GetMembersStatistics) {
		const params = toParams(request);
		return this.http
			.get('/api/timesheet/statistics/members', { params })
			.toPromise();
	}
}
