import { LocalStore, TTimeSlot } from '@gauzy/desktop-lib';
import { getAuthConfig, getApiBaseUrl } from './util';
import fetch, { HeadersInit } from 'node-fetch';

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

	get baseURL(): string {
		const configs: { serverUrl: string; port: string } = LocalStore.getStore('configs');
		const baseUrl = getApiBaseUrl(configs);
		return baseUrl;
	}

	post(uriPath: string, payload: Record<string, unknown>) {
		return this.request(uriPath, { method: 'POST', body: JSON.stringify(payload) })
	}

	saveTimeSlot(payload: TTimeSlot) {
		const path: string = '/api/timesheet/time-slot';
		return this.post(path, payload);
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
