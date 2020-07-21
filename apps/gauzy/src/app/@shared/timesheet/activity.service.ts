import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Activity, IGetActivitiesInput, DailyActivity } from '@gauzy/models';
import { toParams } from 'libs/utils';

@Injectable({
	providedIn: 'root'
})
export class ActivityService {
	constructor(private http: HttpClient) {}

	getActivites(request: IGetActivitiesInput) {
		return this.http
			.get<Activity[]>('/api/timesheet/activity', {
				params: toParams(request)
			})
			.toPromise();
	}

	getDailyActivites(request: IGetActivitiesInput) {
		return this.http
			.get<DailyActivity[]>('/api/timesheet/activity/daily', {
				params: toParams(request)
			})
			.toPromise();
	}
}
