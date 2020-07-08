import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
	TimeLog,
	IGetTimeLogInput,
	IManualTimeInput,
	TimesheetStatus,
	Timesheet,
	IGetTimesheetInput,
	IGetTimeLogConflictInput,
	IGetTimeSlotInput,
	TimeSlot
} from '@gauzy/models';
import { toParams } from 'libs/utils';

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

	checkOverlaps(request: IGetTimeLogConflictInput): Promise<TimeLog[]> {
		return this.http
			.get<TimeLog[]>('/api/timesheet/time-log/conflict', {
				params: toParams(request)
			})
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

	getTimeSheets(request?: IGetTimesheetInput) {
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
		const params = toParams(request);
		return this.http
			.get('/api/timesheet/time-log', { params })
			.toPromise()
			.then((data: TimeLog[]) => {
				return data;
			});
	}

	getTimeLog(id: string, findOptions) {
		const params = toParams(findOptions);
		return this.http
			.get(`/api/timesheet/time-log/${id}`, { params })
			.toPromise()
			.then((data: TimeLog) => {
				return data;
			});
	}
	getTimeSlots(request?: IGetTimeSlotInput) {
		const params = toParams(request);
		return this.http
			.get('/api/timesheet/time-slot', { params })
			.toPromise()
			.then((data: TimeSlot[]) => {
				return data;
			});
	}

	deleteLogs(logIds: string | string[]) {
		let payload = new HttpParams();
		if (typeof logIds === 'string') {
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
