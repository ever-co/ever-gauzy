import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TimeLog, ITimerToggleInput } from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class TimeTrackerService {
	constructor(private http: HttpClient) {}

	getTimerStatus(): Promise<TimeLog> {
		return this.http
			.get<TimeLog>('/api/timesheet/timer/status')
			.toPromise();
	}

	toggleTimer(request: ITimerToggleInput): Promise<TimeLog> {
		return this.http
			.post<TimeLog>('/api/timesheet/timer/toggle', request)
			.toPromise();
	}
}
