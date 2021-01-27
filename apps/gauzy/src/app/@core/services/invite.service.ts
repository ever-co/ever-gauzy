import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	ICreateEmailInvitesInput,
	ICreateEmailInvitesOutput,
	IInvite,
	IInviteFindInput,
	IPublicInviteFindInput,
	IInviteAcceptInput,
	IInviteResendInput,
	IOrganizationContact,
	IOrganizationContactAcceptInviteInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';

@Injectable()
export class InviteService {
	constructor(private http: HttpClient) {}

	createWithEmails(
		createInput: ICreateEmailInvitesInput
	): Promise<ICreateEmailInvitesOutput> {
		return this.http
			.post<ICreateEmailInvitesOutput>('/api/invite/emails', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations: string[],
		findInput?: IInviteFindInput
	): Promise<{ items: IInvite[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IInvite[]; total: number }>(`/api/invite/all`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	validateInvite(
		relations: string[],
		findInput: IPublicInviteFindInput
	): Promise<IInvite> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<IInvite>(`/api/invite/validate`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/invite/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	acceptEmployeeInvite(acceptInviteInput: IInviteAcceptInput): Promise<any> {
		return this.http
			.post(`/api/invite/employee`, acceptInviteInput)
			.pipe(first())
			.toPromise();
	}
	acceptCandidateInvite(acceptInviteInput: IInviteAcceptInput): Promise<any> {
		return this.http
			.post(`/api/invite/candidate`, acceptInviteInput)
			.pipe(first())
			.toPromise();
	}
	acceptUserInvite(acceptInviteInput: IInviteAcceptInput): Promise<any> {
		return this.http
			.post(`/api/invite/user`, acceptInviteInput)
			.pipe(first())
			.toPromise();
	}

	resendInvite(inviteResendInput: IInviteResendInput): Promise<any> {
		return this.http
			.post(`/api/invite/resend`, inviteResendInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http.delete(`/api/invite/${id}`).pipe(first()).toPromise();
	}

	inviteOrganizationContact(
		organizationContactId: string
	): Promise<IOrganizationContact> {
		return this.http
			.put<IOrganizationContact>(
				`/api/invite/organization-contact/${organizationContactId}`,
				{}
			)
			.pipe(first())
			.toPromise();
	}

	acceptOrganizationContactInvite(
		acceptInviteInput: IOrganizationContactAcceptInviteInput
	) {
		return this.http
			.post(`/api/invite/contact`, acceptInviteInput)
			.pipe(first())
			.toPromise();
	}
}
