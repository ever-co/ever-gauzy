import { LocalStore, TTimeSlot } from '@gauzy/desktop-lib';
import { getAuthConfig, getApiBaseUrl, TAuthConfig, TEmployeeResponse, updateAuthConfig, getProjectConfig } from './util';
import fetch, { HeadersInit } from 'node-fetch';
import * as moment from 'moment';
import * as fs from 'node:fs';
import * as FormData from 'form-data';
import { TimeLogSourceEnum, TimeLogType } from '@gauzy/desktop-activity';
import MainEvent from './events/events';
import { MAIN_EVENT, MAIN_EVENT_TYPE } from '../constant';
import { TaskStatusEnum, IBaseTaskProperties, ITaskStatus, IPagination } from '@gauzy/contracts';
import { AgentLogger } from './agent-logger';
import { TOrganizationScreenshotSetting } from './screenshot-interval';

/** A token refresh that has not completed by then is abandoned, for every caller waiting on it */
const TOKEN_REFRESH_TIMEOUT_MS = 30 * 1000;

export interface ITimerResponse {
	deletedAt: any
	createdAt: string
	updatedAt: string
	createdByUserId: string
	updatedByUserId: any
	deletedByUserId: any
	id: string
	isActive: boolean
	isArchived: boolean
	archivedAt: any
	tenantId: string
	organizationId: string
	startedAt: string
	stoppedAt: string
	editedAt: any
	logType: string
	source: string
	description: any
	reason: any
	isBillable: boolean
	isRunning: boolean
	version: any
	employeeId: string
	timesheetId: string
	projectId: any
	taskId: any
	organizationContactId: any
	organizationTeamId: any
	duration: number
	isEdited: boolean
}

export interface ITimeLogPayload {
	isBillable: boolean;
	organizationId: string;
	tenantId: string;
	logType?: string;
	startedAt: Date;
	stoppedAt: Date;
	source?: string;
	employeeId: string;
}


type UploadParams = {
	timeSlotId?: string;
	tenantId: string;
	organizationId: string;
	recordedAt: string;
}

export type TResponseTimeSlot = {
	id?: string,
	recordedAt?: string
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
	duration: number;
	running: boolean;
	lastLog: ITimeLogResp | null;
	startedAt?: Date;
}

export interface ITimeLogResp {
	deletedAt: any
	createdAt: string
	updatedAt: string
	createdByUserId: any
	updatedByUserId: any
	deletedByUserId: any
	id: string
	isActive: boolean
	isArchived: boolean
	archivedAt: any
	tenantId: string
	organizationId: string
	startedAt: string
	stoppedAt: string
	editedAt: any
	logType: string
	source: string
	description: any
	reason: any
	isBillable: boolean
	isRunning: boolean
	version: any
	employeeId: string
	timesheetId: string
	projectId: any
	taskId: string
	organizationContactId: any
	organizationTeamId: any
	duration: number
	isEdited: boolean
}

export type TUpdateTaskStatusReq = {
	title: string,
	status: TaskStatusEnum,
	organizationId: string,
	tenantId: string
}


export class ApiService {
	static instance: ApiService;
	private mainEvent: MainEvent;
	private isLogout: boolean;
	private statusProgress: ITaskStatus;
	private agentLogger: AgentLogger;
	private refreshPromise: Promise<string | boolean> | null = null;

	constructor() {
		this.mainEvent = MainEvent.getInstance();
		this.agentLogger = AgentLogger.getInstance();
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

	post(uriPath: string, payload: Record<string, any>): Promise<Record<string, unknown>> {
		return this.request(uriPath, { method: 'POST', body: JSON.stringify(payload) });
	}

	postFile(uriPath: string, payload: any): Promise<Record<string, unknown>> {
		return this.request(uriPath, { method: 'POST', body: payload, headers: {} }, true)
	}

	get(uriPath: string, params: Record<string, unknown>, timeoutMs?: number): Promise<Record<string, unknown>> {
		return this.request(uriPath, { method: 'GET', headers: {}, params, timeoutMs }, false);
	}

	put(uriPath: string, payload: Record<string, any>): Promise<Record<string, unknown>> {
		return this.request(uriPath, { method: 'PUT', body: JSON.stringify(payload) });
	}

	saveTimeSlot(payload: TTimeSlot): Promise<TResponseTimeSlot> {
		const path: string = '/api/timesheet/time-slot';
		return this.post(path, payload);
	}

	getTimeToggleParams(payload: TToggleParams): TTimerParams {
		const projectConfig = getProjectConfig();
		return {
			description: '',
			isBillable: true,
			logType: TimeLogType.TRACKED,
			projectId: projectConfig.projectId,
			taskId: projectConfig.taskId || null,
			source: TimeLogSourceEnum.DESKTOP,
			manualTimeSlot: null,
			organizationId: payload.organizationId,
			tenantId: payload.tenantId,
			organizationContactId: payload.organizationContactId || projectConfig.organizationContactId || null,
			isRunning: true,
			version: null,
			startedAt: moment(payload.startedAt).utc().toISOString(),
			organizationTeamId: payload.organizationTeamId
		};
	}

	startTimer(payload: TToggleParams): Promise<Partial<ITimerResponse>> {
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

	updateTimeLog(timeLogId: string, payload: ITimeLogPayload): Promise<Partial<ITimeLogResp>> {
		const path: string = `/api/timesheet/time-log/${timeLogId}`;
		const timeLogPayload = {
			startedAt: moment(payload.startedAt).utc().toISOString(),
			stoppedAt: moment(payload.stoppedAt).utc().toISOString(),
			isBillable: true,
			logType: TimeLogType.TRACKED,
			source: TimeLogSourceEnum.DESKTOP,
			tenantId: payload.tenantId,
			organizationId: payload.organizationId,
			employeeId: payload.employeeId
		}
		return this.put(path, timeLogPayload);
	}

	addTimeLog(payload: ITimeLogPayload): Promise<Partial<ITimeLogResp>> {
		const path: string = `/api/timesheet/time-log`;
		const timeLogPayload = {
			startedAt: moment(payload.startedAt).utc().toISOString(),
			stoppedAt: moment(payload.stoppedAt).utc().toISOString(),
			isBillable: true,
			logType: TimeLogType.TRACKED,
			source: TimeLogSourceEnum.DESKTOP,
			tenantId: payload.tenantId,
			organizationId: payload.organizationId,
			employeeId: payload.employeeId
		}
		return this.post(path, timeLogPayload);
	}

	toUTC(date: string | Date | moment.Moment): moment.Moment {
		return moment(date).utc();
	}

	timerStatus(params: TTimerStatusParams): Promise<Partial<TTimerStatusResponse>> {
		const path = '/api/timesheet/timer/status';
		const reqParams = {
			tenantId: params.tenantId,
			organizationId: params.organizationId,
			todayStart: this.toUTC(moment().startOf('day')).format('YYYY-MM-DD HH:mm:ss'),
			todayEnd: this.toUTC(moment().endOf('day')).format('YYYY-MM-DD HH:mm:ss')
		};
		return this.get(path, reqParams);
	}

	async serverCheck(): Promise<boolean> {
		const path = '/api';
		try {
			const res = await this.get(path, {});
			if (res) {
				return true;
			}
			return false;
		} catch (error) {
			return false;
		}

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
		// With its organisation: the agent captures the screen only when the organisation allows it too (issue #9872)
		const employee: Partial<TEmployeeResponse> = await this.get(path, { 'relations[0]': 'organization' });
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

	/**
	 * The organisation's timer settings (screenshot frequency among them), read where the desktop timer reads them:
	 * the signed-in user's employee organisation. `null` when the response carries none. The whole request, a token
	 * refresh and retry after a 401 included, rejects once `timeoutMs` has passed, so it cannot hold up later
	 * refreshes.
	 */
	async getOrganizationTimerSetting(timeoutMs?: number): Promise<TOrganizationScreenshotSetting | null> {
		const user = (await this.get(
			'/api/user/me',
			{ includeEmployee: true, includeOrganization: true },
			timeoutMs
		)) as { employee?: { organization?: TOrganizationScreenshotSetting | null } | null };
		return user?.employee?.organization ?? null;
	}

	refreshToken(): Promise<string | boolean> {
		// The server rotates refresh tokens, so concurrent 401s must share one refresh call
		if (!this.refreshPromise) {
			this.refreshPromise = this.requestTokenRefresh().finally(() => {
				this.refreshPromise = null;
			});
		}
		return this.refreshPromise;
	}

	private async requestTokenRefresh(): Promise<string | boolean> {
		const authConfig = getAuthConfig();
		if (!authConfig.refreshToken) {
			return false;
		}
		let url = this.baseURL + '/api/auth/refresh-token';
		// Shared by every caller waiting on a 401, so it has its own deadline rather than one caller's
		const controller = new AbortController();
		const deadline = setTimeout(() => controller.abort(), TOKEN_REFRESH_TIMEOUT_MS);
		const res = await fetch(url, {
			method: 'POST',
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				refresh_token: authConfig.refreshToken
			}),
			signal: controller.signal
		}).finally(() => clearTimeout(deadline));
		if (res.ok) {
			// node-fetch 3 types a JSON body as unknown
			const resJson = (await res.json()) as { token: string; refresh_token?: string };
			if (resJson?.token) {
				updateAuthConfig(resJson.token, resJson.refresh_token);
				return resJson.token;
			}
		}
		return false;
	}

	async isAuthenticated(): Promise<boolean> {
		const path = '/api/auth/authenticated';
		try {
			const res = await this.get(path, {});
			if (res) {
				return true;
			}
			return false;
		} catch (error) {
			return false;
		}
	}

	async getTask(taskId: string): Promise<Partial<IBaseTaskProperties>> {
		const path = `/api/tasks/${taskId}`;
		return this.get(path, {});
	}

	async updateTaskStatus(taskId: string, task: TUpdateTaskStatusReq) {
		const path = `/api/tasks/${taskId}`;
		await this.getTasksStatuses({
			tenantId: task.tenantId,
			organizationId: task.organizationId
		});

		return this.put(path, {
			...task,
			...(this.statusProgress?.id ? {
				taskStatusId: this.statusProgress.id
			} : {})
		});
	}

	async getTasksStatuses({
		tenantId,
		organizationId
	}: { tenantId: string, organizationId: string }): Promise<void> {
		if (this.statusProgress) {
			return;
		}
		const path = `/api/task-statuses`;
		const taskStatuses: Partial<IPagination<ITaskStatus>> = await this.get(path, {
			tenantId,
			organizationId
		});
		this.statusProgress = taskStatuses.items?.find((i) => i.value === TaskStatusEnum.IN_PROGRESS);
	}

	/** Stop waiting for `promise` (without cancelling it) once `deadlineAt` has passed */
	private withinDeadline<T>(promise: Promise<T>, deadlineAt: number | null): Promise<T> {
		if (!deadlineAt) {
			return promise;
		}
		let timer: ReturnType<typeof setTimeout>;
		const expired = new Promise<never>((_, reject) => {
			timer = setTimeout(
				() => reject(new Error('The request timed out while waiting for the token refresh')),
				Math.max(0, deadlineAt - Date.now())
			);
		});
		return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
	}

	async request(
		path: string,
		options: {
			headers?: HeadersInit;
			method: 'POST' | 'GET' | 'PUT';
			body?: string;
			params?: any;
			/** GET only: abort the request (and reject) when it has not completed after this many milliseconds */
			timeoutMs?: number
		} = { method: 'GET' },
		isFile?: boolean,
		isRetry = false
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

		const controller = options.method === 'GET' && options.timeoutMs > 0 ? new AbortController() : null;
		const deadline = controller ? setTimeout(() => controller.abort(), options.timeoutMs) : null;
		const deadlineAt = controller ? Date.now() + options.timeoutMs : null;
		const requestOptions = options.method === 'GET'
			? { method: options.method, headers, ...(controller ? { signal: controller.signal } : {}) }
			: { ...options, headers };

		try {
			console.log('url', url);
			// console.log('options data', JSON.stringify(requestOptions));
			const response = await fetch(url, requestOptions);
			console.log(`API ${options.method} ${path}: ${response.status} ${response.statusText}`);
			if (!response.ok) {
				const respText = await response.text();
				console.warn('[Response Error]', response.status, respText);
				if (response.status === 401 && !this.isLogout) {
					// Retry only once: a second 401 with a fresh token means the access itself is revoked
					// With a deadline, the wait for the (shared) token refresh and the retry fit in what is left of it
					const refreshedToken = isRetry ? false : await this.withinDeadline(this.refreshToken(), deadlineAt);
					if (refreshedToken) {
						requestOptions.headers.Authorization = `Bearer ${refreshedToken as string}`;
						const retryOptions = deadlineAt
							? { ...options, timeoutMs: Math.max(1, deadlineAt - Date.now()) }
							: options;
						return this.request(path, retryOptions, isFile, true);
					}
					this.handleUnAuthorize();
				}
				const error = new Error(`API error: ${response.status} ${respText}`);
				error['status'] = response.status;
				throw error;
			}
			if (this.isLogout) {
				this.isLogout = false;
			}
			// node-fetch 3 types a JSON body as unknown
			const respJson = (await response.json()) as Record<string, unknown>;
			return respJson;
		} catch (err) {
			this.agentLogger.error(`Error API call, ${err.message}`);
			console.error('[Network Error]', err);
			const enhancedError = err instanceof Error ? err : new Error(String(err));
			enhancedError['url'] = url;
			enhancedError['isNetworkError'] = true;
			throw enhancedError;
		} finally {
			if (deadline) {
				clearTimeout(deadline);
			}
		}
	}
}
