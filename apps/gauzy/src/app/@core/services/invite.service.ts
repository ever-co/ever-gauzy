import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	CreateEmailInvitesInput,
	CreateEmailInvitesOutput,
	Invite,
	InviteFindInput,
	PublicInviteFindInput,
	InviteAcceptInput,
	InviteResendInput,
	OrganizationClients,
	LinkClientOrganizationInviteInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class InviteService {
	constructor(private http: HttpClient) {}

	createWithEmails(
		createInput: CreateEmailInvitesInput
	): Promise<CreateEmailInvitesOutput> {
		return this.http
			.post<CreateEmailInvitesOutput>('/api/invite/emails', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations: string[],
		findInput?: InviteFindInput
	): Promise<{ items: Invite[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: Invite[]; total: number }>(`/api/invite/all`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	validateInvite(
		relations: string[],
		findInput: PublicInviteFindInput
	): Promise<Invite> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<Invite>(`/api/invite/validate`, {
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

	acceptEmployeeInvite(acceptInviteInput: InviteAcceptInput): Promise<any> {
		return this.http
			.post(`/api/invite/employee`, acceptInviteInput)
			.pipe(first())
			.toPromise();
	}
	acceptCandidateInvite(acceptInviteInput: InviteAcceptInput): Promise<any> {
		return this.http
			.post(`/api/invite/candidate`, acceptInviteInput)
			.pipe(first())
			.toPromise();
	}
	acceptUserInvite(acceptInviteInput: InviteAcceptInput): Promise<any> {
		return this.http
			.post(`/api/invite/user`, acceptInviteInput)
			.pipe(first())
			.toPromise();
	}

	resendInvite(inviteResendInput: InviteResendInput): Promise<any> {
		return this.http
			.post(`/api/invite/resend`, inviteResendInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/invite/${id}`)
			.pipe(first())
			.toPromise();
	}

	inviteOrganizationClient(
		organizationClientId: string
	): Promise<OrganizationClients> {
		return this.http
			.put<OrganizationClients>(
				`/api/invite/organization-client/${organizationClientId}`,
				{}
			)
			.pipe(first())
			.toPromise();
	}

	linkClientOrganizationInvite(
		data: LinkClientOrganizationInviteInput
	): Promise<OrganizationClients> {
		return this.http
			.put<OrganizationClients>(
				`/api/invite/link-organization-client`,
				data
			)
			.pipe(first())
			.toPromise();
	}
}
