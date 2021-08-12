import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	ITimeOffPolicy,
	ITimeOffPolicyCreateInput,
	ITimeOffPolicyFindInput,
	ITimeOffPolicyUpdateInput,
	ITimeOffCreateInput,
	ITimeOff,
	ITimeOffFindInput,
	IPagination
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
			`${API_PREFIX}/time-off-policy`,
			createInput
		);
	}

	getAllPolicies(
		relations?: string[],
		findInput?: ITimeOffPolicyFindInput
	): Observable<IPagination<ITimeOffPolicy>> {
		const data = JSON.stringify({ relations, findInput });
		return this.http.get<IPagination<ITimeOffPolicy>>(
			`${API_PREFIX}/time-off-policy`,
			{ params: { data } }
		);
	}

	updatePolicy(
		id: string,
		updateInput: ITimeOffPolicyUpdateInput
	): Observable<ITimeOffPolicy> {
		return this.http.put<ITimeOffPolicy>(
			`${API_PREFIX}/time-off-policy/${id}`,
			updateInput
		);
	}

	deletePolicy(id: string): Observable<any> {
		return this.http.delete(`${API_PREFIX}/time-off-policy/${id}`);
	}

	createRequest(timeOffRequest: ITimeOffCreateInput): Observable<ITimeOff> {
		return this.http.post<ITimeOff>(`${API_PREFIX}/time-off-request`, timeOffRequest);
	}

	updateRequest(id: string, timeOffRequest: ITimeOff): Observable<ITimeOff> {
		return this.http.put<ITimeOff>(
			`${API_PREFIX}/time-off-request/${id}`,
			timeOffRequest
		);
	}

	getAllTimeOffRecords(
		relations?: string[],
		findInput?: ITimeOffFindInput,
		filterDate?: Date
	): Observable<IPagination<ITimeOff>> {
		const data = JSON.stringify({ relations, findInput, filterDate });
		return this.http.get<IPagination<ITimeOff>>(
			`${API_PREFIX}/time-off-request`,
			{ params: { data } }
		);
	}

	updateRequestStatus(
		id: string, 
		action: string
	): Observable<ITimeOff> {
		return this.http.put<ITimeOff>(
			`${API_PREFIX}/time-off-request/${action}/${id}`,
			{}
		);
	}

	deleteDaysOffRequest(id: string): Observable<any> {
		return this.http.delete(`${API_PREFIX}/time-off-request/${id}`);
	}
}
