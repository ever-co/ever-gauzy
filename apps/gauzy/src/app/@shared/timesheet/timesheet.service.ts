import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
	TimeLog,
	IGetTimeLogInput,
	IManualTimeInput,
	TimesheetStatus,
	Timesheet
} from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class TimesheetService {
	interval: any;

	constructor(private http: HttpClient) {}

	addTime(request: IManualTimeInput): Promise<TimeLog> {
		return this.http
			.post<TimeLog>('/api/timesheet/time-log', request)
			.toPromise();
	}

	updateTime(id: string, request: IManualTimeInput): Promise<TimeLog> {
		return this.http
			.put<TimeLog>('/api/timesheet/time-log/' + id, request)
			.toPromise();
	}

	getTimeSheet(id: string) {
		return this.http
			.get('/api/timesheet/' + id)
			.toPromise()
			.then((data: Timesheet) => {
				return data;
			});
	}

	getTimeSheets(request?: IGetTimeLogInput) {
		return this.http
			.get('/api/timesheet', { params: { ...request } })
			.toPromise()
			.then((data: Timesheet[]) => {
				return data;
			});
	}

	updateStatus(ids: string | string[], status: TimesheetStatus) {
		return this.http
			.put(`/api/timesheet/status`, { ids, status })
			.toPromise()
			.then((data: any) => {
				return data;
			});
	}

	submitTimeheet(ids: string | string[], status: 'submit' | 'unsubmit') {
		return this.http
			.put(`/api/timesheet/submit`, { ids, status })
			.toPromise()
			.then((data: any) => {
				return data;
			});
	}

	getTimeLogs(request?: IGetTimeLogInput) {
		return this.http
			.get('/api/timesheet/time-log', { params: { ...request } })
			.toPromise()
			.then((data: TimeLog[]) => {
				return data;
			});
	}

	deleteLogs(logIds: string | string[]) {
		let payload = new HttpParams();
		if (typeof logIds == 'string') {
			logIds = [logIds];
		}
		logIds.forEach((id: string) => {
			payload = payload.append(`logIds[]`, id);
		});
		return this.http
			.delete('/api/timesheet/time-log', { params: payload })
			.toPromise();
	}
}
