import { LocalStore, TTimeSlot } from '@gauzy/desktop-lib';
import { getAuthConfig, getApiBaseUrl } from './util';
import fetch, { HeadersInit } from 'node-fetch';
import * as moment from 'moment';
import * as fs from 'fs';
import * as FormData from 'form-data';

type UploadParams = {
	timeSlotId?: string;
	tenantId: string;
	organizationId: string;
	recordedAt: string;
}

export class ApiService {
	static instance: ApiService;
	get token() {
		const auth = getAuthConfig();
		const token = auth.token;
		return token;
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
			'Authorization': `Bearer ${this.token}`,
			'Content-Type': 'application/json'
		}
	}

	get defaultHeadersForm() {
		return {
			'Authorization': `Bearer ${this.token}`
		}
	}

	get baseURL(): string {
		const configs: { serverUrl?: string; port?: string } = LocalStore.getStore('configs');
		const baseUrl = getApiBaseUrl(configs);
		return baseUrl;
	}

	post(uriPath: string, payload: Record<string, unknown>) {
		return this.request(uriPath, { method: 'POST', body: JSON.stringify(payload) })
	}

	postFile(uriPath: string, payload: any) {
		return this.request(uriPath, { method: 'POST', body: payload, headers: payload.getHeaders() })
	}

	saveTimeSlot(payload: TTimeSlot) {
		const path: string = '/api/timesheet/time-slot';
		return this.post(path, payload);
	}

	uploadImages(params: UploadParams, img: any) {
		const formData = new FormData();
		formData.append('file', fs.createReadStream(img.filePath), img.fileName);
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
		} = { method: 'GET' }
	) {
		const url = this.baseURL + path;
		const headers = {
			...this.defaultHeaders,
			...options.headers
		};

		const requestOptions = options.method === 'GET'
			? { method: options.method, headers }
			: { ...options, headers };

		try {
			const response = await fetch(url, requestOptions);
			console.log('json response', response.json());
			if (!response.ok) {
				console.warn('[Response Error]', response.status, response.statusText);
				const error = new Error(`API error: ${response.status} ${response.statusText}`);
				error['status'] = response.status;
				throw error;
			}

			return response;
		} catch (err) {
			console.error('[Network Error]', err);
			const enhancedError = err instanceof Error ? err : new Error(String(err));
			enhancedError['url'] = url;
			enhancedError['isNetworkError'] = true;
			throw enhancedError;
		}
	}
}
