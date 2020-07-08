import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {TimeOffPolicy, TimeOffPolicyCreateInput, TimeOffPolicyFindInput, TimeOffPolicyUpdateInput, TimeOffCreateInput, TimeOff} from '@gauzy/models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root'})
export class TimeOffService {
	constructor(private http: HttpClient) {}

	createPolicy(createInput: TimeOffPolicyCreateInput): Observable<TimeOffPolicy> {
		return this.http.post<TimeOffPolicy>('/api/time-off-policy/create', createInput);
	}

	getAllPolicies(relations?: string[], findInput?: TimeOffPolicyFindInput): Observable<{ items: TimeOffPolicy[], total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http.get<{ items: TimeOffPolicy[], total: number }> (`/api/time-off-policy`, {params: { data } });
	}

	updatePolicy(id: string, updateInput: TimeOffPolicyUpdateInput): Observable<TimeOffPolicy> {
		return this.http.put(`/api/time-off-policy/${id}`, updateInput);
	}

	deletePolicy(id: string): Observable<TimeOffPolicy> {
		return this.http.delete(`/api/time-off-policy/${id}`);
	}

	createRequest(timeOffRequest: TimeOffCreateInput): Observable<TimeOff> {
		return this.http.post('/api/time-off-request', timeOffRequest);
	}
}
