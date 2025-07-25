import { LocalStore, TTimeSlot } from '@gauzy/desktop-lib';
import { getAuthConfig, getApiBaseUrl, TAuthConfig, TEmployeeResponse } from './util';
import fetch, { HeadersInit } from 'node-fetch';
import * as moment from 'moment';
import * as fs from 'node:fs';
import * as FormData from 'form-data';
import { TimeLogSourceEnum, TimeLogType } from '@gauzy/desktop-activity';
import MainEvent from './events/events';
import { MAIN_EVENT, MAIN_EVENT_TYPE } from '../constant';


type UploadParams = {
	timeSlotId?: string;
	tenantId: string;
	organizationId: string;
	recordedAt: string;
}

export type TResponseTimeSlot = {
	id?: string,
	recordedAt?: string,

}

export type TResponseScreenshot = {
	id?: string,
	recordedAt?: string,
	timeSlotId?: string
}

export type TToggleParams = {
	organizationId: string,
	tenantId: string,
	startedAt: Date,
	organizationContactId: string,
	organizationTeamId: string,
	stoppedAt?: Date
}

export type TTimerParams = {
	description: string,
	isBillable: boolean,
	logType: TimeLogType,
	projectId: string | null,
	taskId: string | null,
	source: TimeLogSourceEnum,
	manualTimeSlot: string | null,
	organizationId: string | null,
	tenantId: string | null,
	organizationContactId: string | null,
	isRunning: boolean,
	version: string | null,
	startedAt: string,
	organizationTeamId: string | null,
	stoppedAt?: string
}

export type TTimerStatusParams = {
	tenantId: string,
	organizationId: string
}

export type TTimerStatusResponse = {
	running?: boolean
}



export class ApiService {
	static instance: ApiService;
	private mainEvent: MainEvent;
	private isLogout: boolean;

	constructor() {
		this.mainEvent = MainEvent.getInstance();
	}

	get auth(): Partial<TAuthConfig> {
		const auth = getAuthConfig();
		return auth;
	}

	static getInstance(): ApiService {
		if (!ApiService.instance) {
			ApiService.instance = new ApiService();
		}
		return ApiService.instance;
	}

	get defaultHeaders() {
		return {
			'Authorization': `Bearer ${this.auth?.token}`,
			'Content-Type': 'application/json',
			'tenant-id': this.auth?.user?.employee.tenantId,
			'organization-id': this.auth?.user?.employee.organizationId
		}
	}

	get defaultHeadersForm() {
		return {
			'Authorization': `Bearer ${this.auth?.token}`,
			'tenant-id': this.auth?.user?.employee.tenantId,
			'organization-id': this.auth?.user?.employee.organizationId
		}
	}

	get baseURL(): string {
		const configs: { serverUrl?: string; port?: string } = LocalStore.getStore('configs');
		const baseUrl = getApiBaseUrl(configs);
		return baseUrl;
	}

	post(uriPath: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
		return this.request(uriPath, { method: 'POST', body: JSON.stringify(payload) })
	}

	postFile(uriPath: string, payload: any): Promise<Record<string, unknown>> {
		return this.request(uriPath, { method: 'POST', body: payload, headers: {} }, true)
	}

	get(uriPath: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
		return this.request(uriPath, { method: 'GET', headers: {}, params }, false);
	}

	saveTimeSlot(payload: TTimeSlot): Promise<TResponseTimeSlot> {
		const path: string = '/api/timesheet/time-slot';
		return this.post(path, payload);
	}

	getTimeToggleParams(payload: TToggleParams): TTimerParams {
		return {
			description: '',
			isBillable: true,
			logType: TimeLogType.TRACKED,
			projectId: null,
			taskId: null,
			source: TimeLogSourceEnum.DESKTOP,
			manualTimeSlot: null,
			organizationId: payload.organizationId,
			tenantId: payload.tenantId,
			organizationContactId: payload.organizationContactId,
			isRunning: true,
			version: null,
			startedAt: moment(payload.startedAt).utc().toISOString(),
			organizationTeamId: payload.organizationTeamId
		};
	}

	startTimer(payload: TToggleParams) {
		const path: string = '/api/timesheet/timer/start';
		const payloadTimer = this.getTimeToggleParams(payload);
		return this.post(path, payloadTimer);
	}

	stopTimer(payload: TToggleParams) {
		const path: string = '/api/timesheet/timer/stop';
		const payloadTimer = this.getTimeToggleParams(payload);
		payloadTimer.isRunning = false;
		payloadTimer.stoppedAt = moment(payload.stoppedAt).utc().toISOString();
		return this.post(path, payloadTimer);
	}

	timerStatus(params: TTimerStatusParams): Promise<TTimerStatusResponse> {
		const path = '/api/timesheet/timer/status';
		const reqParams = {
			tenantId: params.tenantId,
			organizationId: params.organizationId
		};
		return this.get(path, reqParams);
	}

	uploadImages(params: UploadParams, img: any): Promise<Partial<TResponseScreenshot>> {
		const formData = new FormData();
		formData.append('file', fs.createReadStream(img.filePath));
		formData.append('tenantId', params.tenantId);
		formData.append('organizationId', params.organizationId);
		formData.append('recordedAt', moment(params.recordedAt).utc().toISOString());
		if (params.timeSlotId) {
			formData.append('timeSlotId', params.timeSlotId);
		}
		return this.postFile('/api/timesheet/screenshot', formData);
	}

	handleUnAuthorize() {
		this.isLogout = true;
		this.mainEvent.emit(MAIN_EVENT, {
			type: MAIN_EVENT_TYPE.LOGOUT_EVENT
		});
	}

	async getEmployeeSetting(employeeId: string): Promise<Partial<TEmployeeResponse>> {
		const authConfig = getAuthConfig();
		const path = `/api/employee/${employeeId}`;
		const employee: Partial<TEmployeeResponse> = await this.get(path, {});
		if (employee?.id) {
			authConfig.user.employee = employee;
			this.mainEvent.emit(MAIN_EVENT, {
				type: MAIN_EVENT_TYPE.UPDATE_APP_SETTING,
				data: {
					employee
				}
			});
		}
		return employee;
	}

	async request(
		path: string,
		options: {
			headers?: HeadersInit;
			method: 'POST' | 'GET';
			body?: string;
			params?: any
		} = { method: 'GET' },
		isFile?: boolean
	): Promise<Record<string, unknown>> {
		let url = this.baseURL + path;
		if (options.method === 'GET' && options.params) {
			const uri = new URL(url);
			uri.search = new URLSearchParams(options.params).toString();
			url = uri.toString();
		}
		const headers = {
			...(isFile ? this.defaultHeadersForm : this.defaultHeaders),
			...options.headers
		};

		const requestOptions = options.method === 'GET'
			? { method: options.method, headers }
			: { ...options, headers };

		try {
			console.log('url', url);
			console.log('options data', JSON.stringify(requestOptions));
			const response = await fetch(url, requestOptions);
			console.log(`API ${options.method} ${path}: ${response.status} ${response.statusText}`);
			if (!response.ok) {
				const respText = await response.text();
				console.warn('[Response Error]', response.status, respText);
				if (response.status === 401 && !this.isLogout) {
					this.handleUnAuthorize();
				}
				const error = new Error(`API error: ${response.status} ${respText}`);
				error['status'] = response.status;
				throw error;
			}
			if (this.isLogout) {
				this.isLogout = false;
			}
			const respJson = await response.json();
			return respJson;
		} catch (err) {
			console.error('[Network Error]', err);
			const enhancedError = err instanceof Error ? err : new Error(String(err));
			enhancedError['url'] = url;
			enhancedError['isNetworkError'] = true;
			throw enhancedError;
		}
	}
}
