import { LocalStore, TTimeSlot } from '@gauzy/desktop-lib';
import { getAuthConfig, getApiBaseUrl, TAuthConfig } from './util';
import fetch, { HeadersInit } from 'node-fetch';
import * as moment from 'moment';
import * as fs from 'node:fs';
import * as FormData from 'form-data';

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

export class ApiService {
	static instance: ApiService;
	get auth(): Partial<TAuthConfig> {
		const auth = getAuthConfig();
		return auth;
	}

	static getInstance(): ApiService {
		if (!ApiService.instance) {
			ApiService.instance = new ApiService();
			return ApiService.instance;
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

	saveTimeSlot(payload: TTimeSlot): Promise<TResponseTimeSlot> {
		const path: string = '/api/timesheet/time-slot';
		return this.post(path, payload);
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

	async request(
		path: string,
		options: {
			headers?: HeadersInit;
			method: 'POST' | 'GET';
			body?: string;
		} = { method: 'GET' },
		isFile?: boolean
	): Promise<Record<string, unknown>> {
		const url = this.baseURL + path;
		const headers = {
			...(isFile ? this.defaultHeadersForm : this.defaultHeaders),
			...options.headers
		};

		const requestOptions = options.method === 'GET'
			? { method: options.method, headers }
			: { ...options, headers };

		try {
			const response = await fetch(url, requestOptions);
			console.log(`API ${options.method} ${path}: ${response.status} ${response.statusText}`);
			if (!response.ok) {
				const respText = await response.text();
				console.warn('[Response Error]', response.status, respText);
				const error = new Error(`API error: ${response.status} ${respText}`);
				error['status'] = response.status;
				throw error;
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
