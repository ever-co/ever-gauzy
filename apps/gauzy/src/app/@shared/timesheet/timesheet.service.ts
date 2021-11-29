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
import { Observable, firstValueFrom } from 'rxjs';
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
		return firstValueFrom(
			this.http
			.post<ITimeLog>(`${API_PREFIX}/timesheet/time-log`, request)
		);
	}

	updateTime(
		id: string,
		request: ITimeLog | Partial<ITimeLog>
	): Promise<ITimeLog> {
		return firstValueFrom(
			this.http
			.put<ITimeLog>(`${API_PREFIX}/timesheet/time-log/` + id, request)
		);
	}

	checkOverlaps(request: IGetTimeLogConflictInput): Promise<ITimeLog[]> {
		return firstValueFrom(
			this.http
			.get<ITimeLog[]>(`${API_PREFIX}/timesheet/time-log/conflict`, {
				params: toParams(request)
			})
		);
	}

	getTimeSheet(id: string) {
		return firstValueFrom(
			this.http
			.get(`${API_PREFIX}/timesheet/` + id)
		).then((data: ITimesheet) => {
			return data;
		});
	}

	getTimeSheets(request?: IGetTimesheetInput) {
		return firstValueFrom(
			this.http
			.get(`${API_PREFIX}/timesheet`, { params: toParams(request) })
		).then((data: ITimesheet[]) => {
			return data;
		});
	}

	getTimeSheetCount(request?: IGetTimesheetInput) {
		return firstValueFrom(
			this.http
			.get(`${API_PREFIX}/timesheet/count`, { params: toParams(request) })
		).then((data: number) => {
			return data;
		});
	}

	updateStatus(ids: string | string[], status: TimesheetStatus) {
		return firstValueFrom(
			this.http
			.put(`${API_PREFIX}/timesheet/status`, { ids, status })
		).then((data: any) => {
			return data;
		});
	}

	submitTimesheet(ids: string | string[], status: 'submit' | 'unsubmit') {
		return firstValueFrom(
			this.http
			.put(`${API_PREFIX}/timesheet/submit`, { ids, status })
		).then((data: any) => {
			return data;
		});
	}

	getTimeLogs(request?: IGetTimeLogInput) {
		const params = toParams(request);
		return firstValueFrom(
			this.http
			.get<ITimeLog[]>(`${API_PREFIX}/timesheet/time-log`, { params })
		);
	}

	getDailyReport(request?: IGetTimeLogInput) {
		const params = toParams(request);
		return firstValueFrom(
			this.http
			.get(`${API_PREFIX}/timesheet/time-log/report/daily`, { params })
		);
	}

	getOwedAmountReport(request?: IGetTimeLogInput) {
		const params = toParams(request);
		return firstValueFrom(
			this.http
			.get<IAmountOwedReport[]>(
				`${API_PREFIX}/timesheet/time-log/report/owed-report`,
				{ params }
			)
		);
	}

	getOwedAmountReportChartData(request?: IGetTimeLogInput) {
		const params = toParams(request);
		return firstValueFrom(
			this.http
			.get(`${API_PREFIX}/timesheet/time-log/report/owed-chart-data`, {
				params
			})
		);
	}

	getDailyReportChart(request: IGetTimeLogReportInput) {
		const params = toParams(request);
		return firstValueFrom(
			this.http
			.get(`${API_PREFIX}/timesheet/time-log/report/daily-chart`, {
				params
			})
		);
	}

	getWeeklyReportChart(request?: IGetTimeLogInput) {
		const params = toParams(request);
		return firstValueFrom(
			this.http
			.get(`${API_PREFIX}/timesheet/time-log/report/weekly`, { params })
		);
	}

	getTimeLimit(request: IGetTimeLimitReportInput) {
		return firstValueFrom(
			this.http
			.get<ITimeLimitReport[]>(
				`${API_PREFIX}/timesheet/time-log/time-limit`,
				{
					params: toParams(request)
				}
			)
		);
	}

	getProjectBudgetLimit(request: IProjectBudgetLimitReportInput) {
		return firstValueFrom(
			this.http
			.get<IProjectBudgetLimitReport[]>(
				`${API_PREFIX}/timesheet/time-log/project-budget-limit`,
				{
					params: toParams(request)
				}
			)
		);
	}

	getClientBudgetLimit(request: IClientBudgetLimitReportInput) {
		return firstValueFrom(
			this.http
			.get<IClientBudgetLimitReport[]>(
				`${API_PREFIX}/timesheet/time-log/client-budget-limit`,
				{
					params: toParams(request)
				}
			)
		);
	}

	getTimeLog(id: string, findOptions) {
		const params = toParams(findOptions);
		return firstValueFrom(
			this.http
			.get(`${API_PREFIX}/timesheet/time-log/${id}`, { params })
		).then((data: ITimeLog) => {
			return data;
		});
	}

	getTimeSlot(id, request?: IGetTimeSlotInput) {
		const params = toParams(request);
		return firstValueFrom(
			this.http
			.get<ITimeSlot>(`${API_PREFIX}/timesheet/time-slot/${id}`, {
				params
			})
		);
	}

	getTimeSlots(request?: IGetTimeSlotInput) {
		const params = toParams(request);
		return firstValueFrom(
			this.http
			.get<ITimeSlot[]>(`${API_PREFIX}/timesheet/time-slot`, { params })
		);
	}

	deleteTimeSlots(ids?: string[]) {
		const params = toParams({ ids });
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/timesheet/time-slot`, { params })
		);
	}

	deleteLogs(logIds: string | string[]) {
		let payload = new HttpParams();
		if (typeof logIds === 'string') {
			logIds = [logIds];
		}
		logIds.forEach((id: string) => {
			payload = payload.append(`logIds[]`, id);
		});
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/timesheet/time-log`, { params: payload })
		);
	}
}
