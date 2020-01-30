import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	TimeOffPolicy,
	TimeOffPolicyCreateInput,
	TimeOffPolicyFindInput
} from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class TimeOffService {
	constructor(private http: HttpClient) {}

	create(createInput: TimeOffPolicyCreateInput): Promise<any> {
		return this.http
			.post<TimeOffPolicy>('/api/time-off/policy/create', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: TimeOffPolicyFindInput
	): Promise<{ items: TimeOffPolicy[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: TimeOffPolicy[]; total: number }>(
				`/api/time-off/policy`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/time-off/${id}`)
			.pipe(first())
			.toPromise();
	}
}
