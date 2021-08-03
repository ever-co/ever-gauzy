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
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class InviteService {
	constructor(private http: HttpClient) {}

	createWithEmails(
		createInput: ICreateEmailInvitesInput
	): Promise<ICreateEmailInvitesOutput> {
		return this.http
			.post<ICreateEmailInvitesOutput>(
				`${API_PREFIX}/invite/emails`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations: string[],
		findInput?: IInviteFindInput
	): Promise<{ items: IInvite[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IInvite[]; total: number }>(
				`${API_PREFIX}/invite`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	validateInvite(
		relations: string[],
		findInput: IPublicInviteFindInput
	): Promise<IInvite> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<IInvite>(`${API_PREFIX}/invite/validate`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/invite/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	acceptEmployeeInvite(acceptInviteInput: IInviteAcceptInput): Promise<any> {
		return this.http
			.post(`${API_PREFIX}/invite/employee`, acceptInviteInput)
			.pipe(first())
			.toPromise();
	}
	acceptCandidateInvite(acceptInviteInput: IInviteAcceptInput): Promise<any> {
		return this.http
			.post(`${API_PREFIX}/invite/candidate`, acceptInviteInput)
			.pipe(first())
			.toPromise();
	}
	acceptUserInvite(acceptInviteInput: IInviteAcceptInput): Promise<any> {
		return this.http
			.post(`${API_PREFIX}/invite/user`, acceptInviteInput)
			.pipe(first())
			.toPromise();
	}

	resendInvite(inviteResendInput: IInviteResendInput): Promise<any> {
		return this.http
			.post(`${API_PREFIX}/invite/resend`, inviteResendInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/invite/${id}`)
			.pipe(first())
			.toPromise();
	}

	inviteOrganizationContact(
		organizationContactId: string
	): Promise<IOrganizationContact> {
		return this.http
			.put<IOrganizationContact>(
				`${API_PREFIX}/invite/organization-contact/${organizationContactId}`,
				{}
			)
			.pipe(first())
			.toPromise();
	}

	acceptOrganizationContactInvite(
		acceptInviteInput: IOrganizationContactAcceptInviteInput
	) {
		return this.http
			.post(`${API_PREFIX}/invite/contact`, acceptInviteInput)
			.pipe(first())
			.toPromise();
	}
}
