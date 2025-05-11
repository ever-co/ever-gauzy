import { LocalStore } from '@gauzy/desktop-lib';
import { getAuthConfig, getApiBaseUrl } from './util';
import fetch, { HeadersInit } from 'node-fetch';

type TTimeSlot = {
	employeeId: string,
	projectId?: string,
	duration: number,
	keyboard: number,
	mouse: number,
	overall: number,
	startedAt: string,
	activities: any,
	timeLogId?: string,
	organizationId: string,
	tenantId: string,
	organizationContactId?: string,
	recordedAt: string
}

export class ApiService {
	constructor() {
	}

	get getToken() {
		const auth = getAuthConfig();
		const token = auth.token;
		return token;
	}

	get defaultHeaders() {
		return {
			'Authorization': 'Bearer ' + this.getToken,
			'Content-Type': 'application/json'
		}
	}

	get baseURL(): string {
		const configs: { serverUrl: string; port: string} = LocalStore.getStore('configs');
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
			body: string;
		} = { method: 'GET', body: JSON.stringify({}) }
	) {
		const url = this.baseURL + path;
		const headers = {
			...this.defaultHeaders,
			...options.headers
		};

		try {
			const response = await fetch(url, { ...options, headers });
			if (!response.ok) {
				console.warn('[Response Error]', response.status, response.statusText);
				throw Error(response.statusText);
			}

			return response;
		} catch (err) {
			console.error('[Network Error]', err);
			throw err;
		}
	}
}
