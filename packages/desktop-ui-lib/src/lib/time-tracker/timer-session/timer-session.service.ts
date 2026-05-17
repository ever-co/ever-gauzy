import { Injectable, inject } from '@angular/core';
import { ElectronService } from '../../electron/services';
import { BehaviorSubject, Observable, map, shareReplay, firstValueFrom } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Store } from '../../services';
import { API_PREFIX } from '../../constants';
import moment from 'moment';
import { ITimeLog } from '@gauzy/contracts';

@Injectable({ providedIn: 'root' })
export class TimerSessionService {
	private readonly _electronService = inject(ElectronService);
	private readonly _http = inject(HttpClient);
	private readonly _store = inject(Store);

	private readonly _sessions$ = new BehaviorSubject<any[]>([]);
	readonly sessionsStream$: Observable<any[]> = this._sessions$.asObservable();

	async getSessionList(dateRange: { start: Date; end: Date }) {
		const result = await this._electronService.ipcRenderer.invoke('GET_TIMER_SESSIONS', dateRange);
		if (result?.length) {
			this._sessions$.next(result);
			return;
		}
		this._sessions$.next([]);
	}

	async getSession(sessionId: number) {
		return await this._electronService.ipcRenderer.invoke('GET_TIMER_SESSION', {
			timerSessionId: sessionId
		});
	}

	async getTimesheets(dateRange: { start: Date; end: Date }): Promise<ITimeLog[]> {
		const params = new HttpParams({
			fromObject: {
				'activityLevel[start]': '0',
				'activityLevel[end]': '100',
				'employeeIds[]': [this._store.user?.employee?.id],
				organizationId: this._store.organizationId || null,
				tenantId: this._store.tenantId || null,
				startDate: moment(dateRange.start).utc().format('YYYY-MM-DD HH:mm:ss'),
				endDate: moment(dateRange.end).utc().format('YYYY-MM-DD HH:mm:ss'),
				timeZone: 'Asia/Jakarta',
				'relations[]': ['project', 'task', 'organizationContact'] // arrays are natively supported!
			}
		});
		const timesheets = this._http.get(`${API_PREFIX}/timesheet/time-log`, { params }).pipe(
			map((res: any) => res)
		);
		return firstValueFrom(timesheets) as Promise<any[]>;
	}
}
