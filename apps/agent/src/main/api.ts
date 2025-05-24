import { LocalStore, TTimeSlot } from '@gauzy/desktop-lib';
import { getAuthConfig, getApiBaseUrl } from './util';
import fetch, { HeadersInit, Response } from 'node-fetch';
import * as moment from 'moment';
import * as fs from 'node:fs';
import { FormData } from 'undici';

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

	post(uriPath: string, payload: Record<string, unknown>): Promise<Response> {
		return this.request(uriPath, { method: 'POST', body: JSON.stringify(payload) })
	}

	postFile(uriPath: string, payload: any): Promise<Response> {
		return this.request(uriPath, { method: 'POST', body: payload, headers: {} }, true)
	}

	saveTimeSlot(payload: TTimeSlot): Promise<Response> {
		const path: string = '/api/timesheet/time-slot';
		return this.post(path, payload);
	}

	uploadImages(params: UploadParams, img: any) {
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
	) {
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
