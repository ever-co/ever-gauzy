import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
	IGoalTimeFrame,
	IKPI,
	ISettingFindInput,
	IGoalGeneralSetting,
	IGoalTimeFrameFindInput,
	IGoalTimeFrameResponse,
	IKpiResponse,
	IGeneralSettingResponse
} from '@gauzy/contracts';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { ToastrService } from './toastr.service';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class GoalSettingsService {
	private readonly TIME_FRAME_URL = `${API_PREFIX}/goal-time-frame`;
	private readonly KPI_URL = `${API_PREFIX}/goal-kpi`;
	private readonly GENERAL_SETTINGS_URL = `${API_PREFIX}/goal-general-setting`;

	constructor(
		private _http: HttpClient,
		private toastrService: ToastrService
	) {}

	// Goal Time Frame
	createTimeFrame(timeFrame): Promise<IGoalTimeFrame> {
		return firstValueFrom(
			this._http
			.post<IGoalTimeFrame>(`${this.TIME_FRAME_URL}`, timeFrame)
		);
	}

	getAllTimeFrames(
		findInput: IGoalTimeFrameFindInput
	): Promise<IGoalTimeFrameResponse> {
		const data = JSON.stringify({ findInput });
		return this._http
			.get<IGoalTimeFrameResponse>(`${this.TIME_FRAME_URL}`, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	deleteTimeFrame(id: string): Promise<any> {
		return firstValueFrom(
			this._http
			.delete(`${this.TIME_FRAME_URL}/${id}`)
		);
	}

	updateTimeFrame(
		id: string,
		goalTimeFrame: IGoalTimeFrame
	): Promise<IGoalTimeFrame> {
		return firstValueFrom(
			this._http
			.put<IGoalTimeFrame>(`${this.TIME_FRAME_URL}/${id}`, goalTimeFrame)
		);
	}

	// KPI
	createKPI(kpi): Promise<IKPI> {
		return firstValueFrom(
			this._http
			.post<IKPI>(`${this.KPI_URL}`, kpi)
		);
	}

	getAllKPI(findInput?: ISettingFindInput): Promise<IKpiResponse> {
		const data = JSON.stringify({ findInput });
		return this._http
			.get<IKpiResponse>(`${this.KPI_URL}`, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	deleteKPI(id: string): Promise<any> {
		return firstValueFrom(
			this._http
			.delete(`${this.KPI_URL}/${id}`)
		);
	}

	updateKPI(id: string, kpiData: IKPI): Promise<IKPI> {
		return firstValueFrom(
			this._http
			.put<IKPI>(`${this.KPI_URL}/${id}`, kpiData)
		);
	}

	// General Goal Settings
	getAllGeneralSettings(
		findInput?: ISettingFindInput
	): Promise<IGeneralSettingResponse> {
		const data = JSON.stringify({ findInput });
		return this._http
			.get<IGeneralSettingResponse>(`${this.GENERAL_SETTINGS_URL}`, {
				params: { data }
			})
			.pipe(catchError((error) => this.errorHandler(error)))
			.toPromise();
	}

	updateGeneralSettings(
		id: string,
		generalSettingData: IGoalGeneralSetting
	): Promise<IGoalGeneralSetting> {
		return firstValueFrom(
			this._http
			.put<IGoalGeneralSetting>(
				`${this.GENERAL_SETTINGS_URL}/${id}`,
				generalSettingData
			)
		);
	}

	errorHandler(error: HttpErrorResponse) {
		this.toastrService.danger(error.message, 'Error');
		return throwError(error.message);
	}
}
