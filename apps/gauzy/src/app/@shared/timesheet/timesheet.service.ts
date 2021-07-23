import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
	ITimeLog,
	IGetTimeLogInput,
	IManualTimeInput,
	TimesheetStatus,
	ITimesheet,
	IGetTimesheetInput,
	IGetTimeLogConflictInput,
	IGetTimeSlotInput,
	ITimeSlot,
	IGetTimeLogReportInput,
	IAmountOwedReport,
	IGetTimeLimitReportInput,
	ITimeLimitReport,
	IClientBudgetLimitReport,
	IProjectBudgetLimitReport,
	IProjectBudgetLimitReportInput,
	IClientBudgetLimitReportInput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { API_PREFIX } from '../../@core/constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class TimesheetService {
	interval: any;

	private _updateLog$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public updateLog$: Observable<boolean> = this._updateLog$.asObservable();

	constructor(private http: HttpClient) {}

	updateLogs(value: boolean) {
		this._updateLog$.next(value);
	}

	addTime(request: IManualTimeInput): Promise<ITimeLog> {
		return this.http
			.post<ITimeLog>(`${API_PREFIX}/timesheet/time-log`, request)
			.toPromise();
	}

	updateTime(
		id: string,
		request: ITimeLog | Partial<ITimeLog>
	): Promise<ITimeLog> {
		return this.http
			.put<ITimeLog>(`${API_PREFIX}/timesheet/time-log/` + id, request)
			.toPromise();
	}

	checkOverlaps(request: IGetTimeLogConflictInput): Promise<ITimeLog[]> {
		return this.http
			.get<ITimeLog[]>(`${API_PREFIX}/timesheet/time-log/conflict`, {
				params: toParams(request)
			})
			.toPromise();
	}

	getTimeSheet(id: string) {
		return this.http
			.get(`${API_PREFIX}/timesheet/` + id)
			.toPromise()
			.then((data: ITimesheet) => {
				return data;
			});
	}

	getTimeSheets(request?: IGetTimesheetInput) {
		return this.http
			.get(`${API_PREFIX}/timesheet`, { params: toParams(request) })
			.toPromise()
			.then((data: ITimesheet[]) => {
				return data;
			});
	}

	getTimeSheetCount(request?: IGetTimesheetInput) {
		return this.http
			.get(`${API_PREFIX}/timesheet/count`, { params: toParams(request) })
			.toPromise()
			.then((data: number) => {
				return data;
			});
	}

	updateStatus(ids: string | string[], status: TimesheetStatus) {
		return this.http
			.put(`${API_PREFIX}/timesheet/status`, { ids, status })
			.toPromise()
			.then((data: any) => {
				return data;
			});
	}

	submitTimesheet(ids: string | string[], status: 'submit' | 'unsubmit') {
		return this.http
			.put(`${API_PREFIX}/timesheet/submit`, { ids, status })
			.toPromise()
			.then((data: any) => {
				return data;
			});
	}

	getTimeLogs(request?: IGetTimeLogInput) {
		const params = toParams(request);
		return this.http
			.get<ITimeLog[]>(`${API_PREFIX}/timesheet/time-log`, { params })
			.toPromise();
	}

	getDailyReport(request?: IGetTimeLogInput) {
		const params = toParams(request);
		return this.http
			.get(`${API_PREFIX}/timesheet/time-log/report/daily`, { params })
			.toPromise();
	}

	getOwedAmountReport(request?: IGetTimeLogInput) {
		const params = toParams(request);
		return this.http
			.get<IAmountOwedReport[]>(
				`${API_PREFIX}/timesheet/time-log/report/owed-report`,
				{ params }
			)
			.toPromise();
	}

	getOwedAmountReportChartData(request?: IGetTimeLogInput) {
		const params = toParams(request);
		return this.http
			.get(`${API_PREFIX}/timesheet/time-log/report/owed-chart-data`, {
				params
			})
			.toPromise();
	}

	getDailyReportChart(request: IGetTimeLogReportInput) {
		const params = toParams(request);
		return this.http
			.get(`${API_PREFIX}/timesheet/time-log/report/daily-chart`, {
				params
			})
			.toPromise();
	}

	getWeeklyReportChart(request?: IGetTimeLogInput) {
		const params = toParams(request);
		return this.http
			.get(`${API_PREFIX}/timesheet/time-log/report/weekly`, { params })
			.toPromise();
	}

	getTimeLimit(request: IGetTimeLimitReportInput) {
		return this.http
			.get<ITimeLimitReport[]>(
				`${API_PREFIX}/timesheet/time-log/time-limit`,
				{
					params: toParams(request)
				}
			)
			.toPromise();
	}

	getProjectBudgetLimit(request: IProjectBudgetLimitReportInput) {
		return this.http
			.get<IProjectBudgetLimitReport[]>(
				`${API_PREFIX}/timesheet/time-log/project-budget-limit`,
				{
					params: toParams(request)
				}
			)
			.toPromise();
	}

	getClientBudgetLimit(request: IClientBudgetLimitReportInput) {
		return this.http
			.get<IClientBudgetLimitReport[]>(
				`${API_PREFIX}/timesheet/time-log/client-budget-limit`,
				{
					params: toParams(request)
				}
			)
			.toPromise();
	}

	getTimeLog(id: string, findOptions) {
		const params = toParams(findOptions);
		return this.http
			.get(`${API_PREFIX}/timesheet/time-log/${id}`, { params })
			.toPromise()
			.then((data: ITimeLog) => {
				return data;
			});
	}

	getTimeSlot(id, request?: IGetTimeSlotInput) {
		const params = toParams(request);
		return this.http
			.get<ITimeSlot>(`${API_PREFIX}/timesheet/time-slot/${id}`, {
				params
			})
			.toPromise();
	}

	getTimeSlots(request?: IGetTimeSlotInput) {
		const params = toParams(request);
		return this.http
			.get<ITimeSlot[]>(`${API_PREFIX}/timesheet/time-slot`, { params })
			.toPromise();
	}

	deleteTimeSlots(ids?: string[]) {
		const params = toParams({ ids });
		return this.http
			.delete(`${API_PREFIX}/timesheet/time-slot`, { params })
			.toPromise();
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
			.delete(`${API_PREFIX}/timesheet/time-log`, { params: payload })
			.toPromise();
	}
}
