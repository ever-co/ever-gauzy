import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	ITimeOffPolicy,
	ITimeOffPolicyCreateInput,
	ITimeOffPolicyFindInput,
	ITimeOffPolicyUpdateInput,
	ITimeOffCreateInput,
	ITimeOff,
	ITimeOffFindInput
} from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({ providedIn: 'root' })
export class TimeOffService {
	constructor(private http: HttpClient) {}

	createPolicy(
		createInput: ITimeOffPolicyCreateInput
	): Observable<ITimeOffPolicy> {
		return this.http.post<ITimeOffPolicy>(
			`${API_PREFIX}/time-off-policy/create`,
			createInput
		);
	}

	getAllPolicies(
		relations?: string[],
		findInput?: ITimeOffPolicyFindInput
	): Observable<{ items: ITimeOffPolicy[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http.get<{ items: ITimeOffPolicy[]; total: number }>(
			`${API_PREFIX}/time-off-policy`,
			{ params: { data } }
		);
	}

	updatePolicy(
		id: string,
		updateInput: ITimeOffPolicyUpdateInput
	): Observable<ITimeOffPolicy> {
		return this.http.put(
			`${API_PREFIX}/time-off-policy/${id}`,
			updateInput
		);
	}

	deletePolicy(id: string): Observable<ITimeOffPolicy> {
		return this.http.delete(`${API_PREFIX}/time-off-policy/${id}`);
	}

	createRequest(timeOffRequest: ITimeOffCreateInput): Observable<ITimeOff> {
		return this.http.post(`${API_PREFIX}/time-off-request`, timeOffRequest);
	}

	updateRequest(id: string, timeOffRequest: ITimeOff): Observable<ITimeOff> {
		return this.http.put(
			`${API_PREFIX}/time-off-request/${id}`,
			timeOffRequest
		);
	}

	getAllTimeOffRecords(
		relations?: string[],
		findInput?: ITimeOffFindInput,
		filterDate?: Date
	): Observable<{ items: ITimeOff[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, filterDate });

		return this.http.get<{ items: ITimeOff[]; total: number }>(
			`${API_PREFIX}/time-off-request`,
			{ params: { data } }
		);
	}

	updateRequestStatus(id: string, action: string): Observable<ITimeOff> {
		return this.http.put(
			`${API_PREFIX}/time-off-request/${action}/${id}`,
			{}
		);
	}

	deleteDaysOffRequest(id: string): Observable<ITimeOff> {
		return this.http.delete(`${API_PREFIX}/time-off-request/${id}`);
	}
}
