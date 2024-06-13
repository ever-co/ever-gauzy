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
	IOrganizationContactAcceptInviteInput,
	IAuthResponse
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class InviteService {
	constructor(private http: HttpClient) {}

	createWithEmails(createInput: ICreateEmailInvitesInput): Promise<ICreateEmailInvitesOutput> {
		return firstValueFrom(this.http.post<ICreateEmailInvitesOutput>(`${API_PREFIX}/invite/emails`, createInput));
	}

	getAll(relations: string[], findInput?: IInviteFindInput): Promise<{ items: IInvite[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return firstValueFrom(
			this.http.get<{ items: IInvite[]; total: number }>(`${API_PREFIX}/invite`, {
				params: { data }
			})
		);
	}

	validateInvite(relations: string[], where: IPublicInviteFindInput): Promise<IInvite> {
		return firstValueFrom(
			this.http.get<IInvite>(`${API_PREFIX}/invite/validate`, {
				params: toParams({ ...where, relations })
			})
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/invite/${id}`, updateInput));
	}

	acceptInvite(input: Partial<IInviteAcceptInput>): Promise<IAuthResponse> {
		return firstValueFrom(this.http.post<IAuthResponse>(`${API_PREFIX}/invite/accept`, input));
	}

	resendInvite(inviteResendInput: IInviteResendInput): Promise<any> {
		return firstValueFrom(this.http.post(`${API_PREFIX}/invite/resend`, inviteResendInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/invite/${id}`));
	}

	inviteOrganizationContact(organizationContactId: string): Promise<IOrganizationContact> {
		return firstValueFrom(
			this.http.put<IOrganizationContact>(
				`${API_PREFIX}/invite/organization-contact/${organizationContactId}`,
				{}
			)
		);
	}

	acceptOrganizationContactInvite(acceptInviteInput: IOrganizationContactAcceptInviteInput) {
		return firstValueFrom(this.http.post(`${API_PREFIX}/invite/contact`, acceptInviteInput));
	}
}
