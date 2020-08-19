import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	GetTimeSlotStatistics,
	GetActivitiesStatistics,
	GetProjectsStatistics,
	GetMembersStatistics,
	GetTasksStatistics,
	GetCountsStatistics,
	CountsStatistics,
	MembersStatistics,
	ActivitiesStatistics,
	TimeSlotStatistics,
	ProjectsStatistics,
	TasksStatistics,
	ManualTimesStatistics
} from '@gauzy/models';
import { toParams } from 'libs/utils';

@Injectable({
	providedIn: 'root'
})
export class TimesheetStatisticsService {
	constructor(private http: HttpClient) {}

	getCounts(request: GetCountsStatistics) {
		const params = toParams(request);
		return this.http
			.get<CountsStatistics>('/api/timesheet/statistics/counts', {
				params
			})
			.toPromise();
	}

	getTimeSlots(request?: GetTimeSlotStatistics) {
		const params = toParams(request);
		return this.http
			.get<TimeSlotStatistics[]>('/api/timesheet/statistics/time-slots', {
				params
			})
			.toPromise();
	}

	getActivities(request?: GetActivitiesStatistics) {
		const params = toParams(request);
		return this.http
			.get<ActivitiesStatistics[]>(
				'/api/timesheet/statistics/activities',
				{ params }
			)
			.toPromise();
	}

	getTasks(request: GetTasksStatistics) {
		const params = toParams(request);
		return this.http
			.get<TasksStatistics[]>('/api/timesheet/statistics/tasks', {
				params
			})
			.toPromise();
	}

	getManualTimes(request: any) {
		const params = toParams(request);
		return this.http
			.get<ManualTimesStatistics[]>(
				'/api/timesheet/statistics/manual-times',
				{ params }
			)
			.toPromise();
	}

	getProjects(request?: GetProjectsStatistics) {
		const params = toParams(request);
		return this.http
			.get<ProjectsStatistics[]>('/api/timesheet/statistics/projects', {
				params
			})
			.toPromise();
	}

	getMembers(request: GetMembersStatistics) {
		const params = toParams(request);
		return this.http
			.get<MembersStatistics[]>('/api/timesheet/statistics/members', {
				params
			})
			.toPromise();
	}
}
