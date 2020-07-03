import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	TimeOffPolicy,
	TimeOffPolicyCreateInput,
	TimeOffPolicyFindInput,
	TimeOffPolicyUpdateInput
} from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class TimeOffService {
	constructor(private http: HttpClient) {}

	createPolicy(createInput: TimeOffPolicyCreateInput): Promise<any> {
		return this.http
			.post<TimeOffPolicy>('/api/time-off-policy/create', createInput)
			.pipe(first())
			.toPromise();
	}

	getAllPolicies(
		relations?: string[],
		findInput?: TimeOffPolicyFindInput
	): Promise<{ items: TimeOffPolicy[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: TimeOffPolicy[]; total: number }>(
				`/api/time-off-policy`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	updatePolicy(
		id: string,
		updateInput: TimeOffPolicyUpdateInput
	): Promise<any> {
		return this.http
			.put(`/api/time-off-policy/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	deletePolicy(id: string): Promise<any> {
		return this.http
			.delete(`/api/time-off-policy/${id}`)
			.pipe(first())
			.toPromise();
	}

	createRequest(timeOffRequest) {
		return this.http
			.post('/api/time-off-request', timeOffRequest)
			.pipe(first())
			.toPromise();
	}
}
