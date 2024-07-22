import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import {
	ITimeLog,
	IGetTimeLogInput,
	IManualTimeInput,
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
	IReportDayData,
	ReportDayData,
	IUpdateTimesheetStatusInput,
	ISubmitTimesheetInput,
	IScreenshot,
	IBasePerTenantAndOrganizationEntityModel
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

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
		return firstValueFrom(this.http.post<ITimeLog>(`${API_PREFIX}/timesheet/time-log`, request));
	}

	updateTime(id: string, request: ITimeLog | Partial<ITimeLog>): Promise<ITimeLog> {
		return firstValueFrom(this.http.put<ITimeLog>(`${API_PREFIX}/timesheet/time-log/` + id, request));
	}

	checkOverlaps(request: IGetTimeLogConflictInput): Promise<ITimeLog[]> {
		return firstValueFrom(
			this.http.get<ITimeLog[]>(`${API_PREFIX}/timesheet/time-log/conflict`, {
				params: toParams(request)
			})
		);
	}

	getTimeSheet(id: string) {
		return this.http.get(`${API_PREFIX}/timesheet/${id}`);
	}

	getTimeSheets(request?: IGetTimesheetInput) {
		return firstValueFrom(this.http.get(`${API_PREFIX}/timesheet`, { params: toParams(request) })).then(
			(data: ITimesheet[]) => {
				return data;
			}
		);
	}

	getTimeSheetCount(request?: IGetTimesheetInput) {
		return firstValueFrom(this.http.get(`${API_PREFIX}/timesheet/count`, { params: toParams(request) })).then(
			(data: number) => {
				return data;
			}
		);
	}

	updateStatus(request: IUpdateTimesheetStatusInput): Promise<ITimesheet[]> {
		return firstValueFrom(
			this.http.put<ITimesheet[]>(`${API_PREFIX}/timesheet/status`, {
				...request
			})
		);
	}

	submitTimesheet(request: ISubmitTimesheetInput): Promise<ITimesheet[]> {
		return firstValueFrom(
			this.http.put<ITimesheet[]>(`${API_PREFIX}/timesheet/submit`, {
				...request
			})
		);
	}

	getTimeLogs(request?: IGetTimeLogInput, relations = []) {
		return firstValueFrom(
			this.http.get<ITimeLog[]>(`${API_PREFIX}/timesheet/time-log`, {
				params: toParams({ ...request, relations })
			})
		);
	}

	/**
	 * Fetches daily report data based on the provided request parameters.
	 *
	 * @param request - Parameters for customizing the request (IGetTimeLogInput).
	 * @returns A Promise that resolves to the daily report data.
	 */
	async getDailyReport(request: IGetTimeLogInput): Promise<IReportDayData[]> {
		// Convert the request parameters to URL query parameters
		const params = toParams(request);
		return firstValueFrom(
			this.http.get<IReportDayData[]>(`${API_PREFIX}/timesheet/time-log/report/daily`, { params })
		);
	}

	/**
	 * Fetches daily report chart data based on the provided request parameters.
	 *
	 * @param request - Parameters for customizing the request (IGetTimeLogReportInput).
	 * @returns A Promise that resolves to the daily report chart data.
	 */
	async getDailyReportChart(request: IGetTimeLogReportInput) {
		// Convert the request parameters to URL query parameters
		const params = toParams(request);
		return firstValueFrom(this.http.get(`${API_PREFIX}/timesheet/time-log/report/daily-chart`, { params }));
	}

	/**
	 * Retrieves the amount owed report based on the provided request parameters.
	 *
	 * @param request - Optional parameters for customizing the request (IGetTimeLogInput).
	 * @returns A Promise that resolves to the amount owed report data.
	 */
	async getOwedAmountReport(request: IGetTimeLogInput = {}): Promise<IAmountOwedReport[]> {
		// Convert the request parameters to URL query parameters
		const params = toParams(request);
		return firstValueFrom(
			this.http.get<IAmountOwedReport[]>(`${API_PREFIX}/timesheet/time-log/report/owed-report`, { params })
		);
	}

	/**
	 * Retrieves chart data for the owed amount report based on the provided request parameters.
	 *
	 * @param request - Optional parameters for customizing the request (IGetTimeLogInput).
	 * @returns A Promise that resolves to the chart data for the owed amount report.
	 */
	async getOwedAmountReportChartData(request: IGetTimeLogInput = {}): Promise<any> {
		// Convert the request parameters to URL query parameters
		const params = toParams(request);
		return firstValueFrom(this.http.get(`${API_PREFIX}/timesheet/time-log/report/owed-charts`, { params }));
	}

	/**
	 * Fetches weekly report chart data based on the provided request parameters.
	 *
	 * @param request - Optional parameters for customizing the request (IGetTimeLogInput).
	 * @returns A Promise that resolves to the weekly report chart data.
	 */
	async getWeeklyReportChart(request?: IGetTimeLogInput) {
		// Convert the request parameters to URL query parameters
		const params = toParams(request);
		return firstValueFrom(
			this.http.get<ReportDayData[]>(`${API_PREFIX}/timesheet/time-log/report/weekly`, { params })
		);
	}

	/**
	 * Fetches time limit report based on the provided request parameters.
	 *
	 * @param request - Parameters for customizing the request (IGetTimeLimitReportInput).
	 * @returns A Promise that resolves to the time limit report data.
	 */
	async getTimeLimit(request: IGetTimeLimitReportInput) {
		// Convert the request parameters to URL query parameters
		const params = toParams(request);
		return firstValueFrom(
			this.http.get<ITimeLimitReport[]>(`${API_PREFIX}/timesheet/time-log/time-limit`, { params })
		);
	}

	/**
	 * Fetches project budget limit report based on the provided request parameters.
	 *
	 * @param request - Parameters for customizing the request (IGetTimeLogReportInput).
	 * @returns A Promise that resolves to the project budget limit report data.
	 */
	async getProjectBudgetLimit(request: IGetTimeLogReportInput) {
		// Convert the request parameters to URL query parameters
		const params = toParams(request);
		return firstValueFrom(
			this.http.get<IProjectBudgetLimitReport[]>(`${API_PREFIX}/timesheet/time-log/project-budget-limit`, {
				params
			})
		);
	}

	/**
	 * Fetches client budget limit report based on the provided request parameters.
	 *
	 * @param request - Parameters for customizing the request (IGetTimeLogReportInput).
	 * @returns A Promise that resolves to the client budget limit report data.
	 */
	async getClientBudgetLimit(request: IGetTimeLogReportInput): Promise<IClientBudgetLimitReport[]> {
		// Convert the request parameters to URL query parameters
		const params = toParams(request);
		return firstValueFrom(
			this.http.get<IClientBudgetLimitReport[]>(`${API_PREFIX}/timesheet/time-log/client-budget-limit`, {
				params
			})
		);
	}

	getTimeLog(id: string, findOptions) {
		const params = toParams(findOptions);
		return firstValueFrom(this.http.get(`${API_PREFIX}/timesheet/time-log/${id}`, { params })).then(
			(data: ITimeLog) => {
				return data;
			}
		);
	}

	getTimeSlot(id, request?: IGetTimeSlotInput) {
		const params = toParams(request);
		return firstValueFrom(
			this.http.get<ITimeSlot>(`${API_PREFIX}/timesheet/time-slot/${id}`, {
				params
			})
		);
	}

	getTimeSlots(request?: IGetTimeSlotInput) {
		const params = toParams(request);
		return firstValueFrom(this.http.get<ITimeSlot[]>(`${API_PREFIX}/timesheet/time-slot`, { params }));
	}

	deleteTimeSlots(request) {
		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/timesheet/time-slot`, {
				params: toParams(request)
			})
		);
	}

	deleteLogs(request) {
		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/timesheet/time-log`, {
				params: toParams(request)
			})
		);
	}

	deleteScreenshot(id: IScreenshot['id'], params: IBasePerTenantAndOrganizationEntityModel) {
		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/timesheet/screenshot/${id}`, {
				params: toParams(params)
			})
		);
	}
}
