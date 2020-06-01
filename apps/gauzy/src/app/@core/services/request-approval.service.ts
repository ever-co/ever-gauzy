import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RequestApproval, RequestApprovalCreateInput } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class RequestApprovalService {
	REQUETS_APPROVAL_URL = '/api/request-approval';

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: RequestApproval
	): Promise<{ items: RequestApproval[] }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: RequestApproval[] }>(`${this.REQUETS_APPROVAL_URL}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getByEmployeeId(
		id: string,
		relations?: string[]
	): Promise<{ items: RequestApproval[] }> {
		const data = JSON.stringify({ relations });

		return this.http
			.get<{ items: RequestApproval[] }>(
				`${this.REQUETS_APPROVAL_URL}/employee/${id}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.REQUETS_APPROVAL_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	save(
		requestApproval: RequestApprovalCreateInput
	): Promise<RequestApproval> {
		if (!requestApproval.id) {
			return this.http
				.post<RequestApproval>(
					this.REQUETS_APPROVAL_URL,
					requestApproval
				)
				.pipe(first())
				.toPromise();
		} else {
			return this.http
				.put<RequestApproval>(
					`${this.REQUETS_APPROVAL_URL}/${requestApproval.id}`,
					requestApproval
				)
				.pipe(first())
				.toPromise();
		}
	}
}
