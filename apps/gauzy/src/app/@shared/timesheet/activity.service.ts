import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IActivity,
	IGetActivitiesInput,
	IDailyActivity
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../../@core/constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class ActivityService {
	constructor(private http: HttpClient) {}

	getActivities(request: IGetActivitiesInput) {
		return this.http
			.get<IActivity[]>(`${API_PREFIX}/timesheet/activity`, {
				params: toParams(request)
			})
			.toPromise();
	}

	getDailyActivities(request: IGetActivitiesInput) {
		return this.http
			.get<IDailyActivity[]>(`${API_PREFIX}/timesheet/activity/daily`, {
				params: toParams(request)
			})
			.toPromise();
	}

	getDailyActivitiesReport(request: IGetActivitiesInput) {
		return this.http
			.get<IDailyActivity[]>(`${API_PREFIX}/timesheet/activity/report`, {
				params: toParams(request)
			})
			.toPromise();
	}
}
