import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApprovalPolicy, ApprovalPolicyCreateInput } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class ApprovalPolicyService {
	APPROVAL_POLICY_URL = '/api/approval-policy';

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: ApprovalPolicy
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: ApprovalPolicy[]; total: number }>(
				`${this.APPROVAL_POLICY_URL}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.APPROVAL_POLICY_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	save(approvalPolicy: ApprovalPolicyCreateInput): Promise<ApprovalPolicy> {
		if (!approvalPolicy.id) {
			return this.http
				.post<ApprovalPolicy>(this.APPROVAL_POLICY_URL, approvalPolicy)
				.pipe(first())
				.toPromise();
		} else {
			return this.http
				.put<ApprovalPolicy>(
					`${this.APPROVAL_POLICY_URL}/${approvalPolicy.id}`,
					approvalPolicy
				)
				.pipe(first())
				.toPromise();
		}
	}
}
