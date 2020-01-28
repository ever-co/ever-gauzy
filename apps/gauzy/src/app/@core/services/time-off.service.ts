import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { TimeOffPolicy, TimeOffPolicyCreateInput } from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class TimeOffService {
	constructor(private http: HttpClient) {}

	create(createInput: TimeOffPolicyCreateInput): Promise<any> {
		return this.http
			.post<TimeOffPolicy>('/api/time-off/create', createInput)
			.pipe(first())
			.toPromise();
	}
}
