import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IApprovalPolicy, IApprovalPolicyCreateInput } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class ApprovalPolicyService {
	APPROVAL_POLICY_URL = '/api/approval-policy';

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IApprovalPolicy
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IApprovalPolicy[]; total: number }>(
				`${this.APPROVAL_POLICY_URL}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getForRequestApproval(
		relations?: string[],
		findInput?: IApprovalPolicy
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IApprovalPolicy[]; total: number }>(
				`${this.APPROVAL_POLICY_URL}/request-approval`,
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

	save(approvalPolicy: IApprovalPolicyCreateInput): Promise<IApprovalPolicy> {
		if (!approvalPolicy.id) {
			return this.http
				.post<IApprovalPolicy>(this.APPROVAL_POLICY_URL, approvalPolicy)
				.pipe(first())
				.toPromise();
		} else {
			return this.http
				.put<IApprovalPolicy>(
					`${this.APPROVAL_POLICY_URL}/${approvalPolicy.id}`,
					approvalPolicy
				)
				.pipe(first())
				.toPromise();
		}
	}
}
