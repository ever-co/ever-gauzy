import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IActivity, IGetActivitiesInput, IDailyActivity } from '@gauzy/contracts';
import { API_PREFIX, buildHttpParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class ActivityService {
	private http = inject(HttpClient);

	getActivities(request: IGetActivitiesInput) {
		return firstValueFrom(
			this.http.get<IActivity[]>(`${API_PREFIX}/timesheet/activity`, {
				params: buildHttpParams(request)
			})
		);
	}

	getDailyActivities(request: IGetActivitiesInput) {
		return firstValueFrom(
			this.http.get<IDailyActivity[]>(`${API_PREFIX}/timesheet/activity/daily`, {
				params: buildHttpParams(request)
			})
		);
	}

	getDailyActivitiesReport(request: IGetActivitiesInput) {
		return firstValueFrom(
			this.http.get<IDailyActivity[]>(`${API_PREFIX}/timesheet/activity/report`, {
				params: buildHttpParams(request)
			})
		);
	}
}
