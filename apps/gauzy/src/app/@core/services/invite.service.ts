import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationProjectsCreateInput,
	OrganizationProjects,
	OrganizationProjectsFindInput,
	CreateEmailInvitesInput,
	Invite,
	CreateEmailInvitesOutput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class InviteService {
	constructor(private http: HttpClient) {}

	// getInviteByEmail(email: string): Promise<Invite> {
	// 	return this.http
	// 		.get<Invite>(`/api/invite/email/${email}`)
	// 		.pipe(first())
	// 		.toPromise();
	// }

	// getInviteByEmail(email: string): Promise<Invite> {
	// 	return this.http
	// 		.get<Invite>(`/api/invite/email/${email}`)
	// 		.pipe(first())
	// 		.toPromise();
	// }

	createWithEmails(
		createInput: CreateEmailInvitesInput
	): Promise<CreateEmailInvitesOutput> {
		return this.http
			.post<CreateEmailInvitesOutput>('/api/invite/emails', createInput)
			.pipe(first())
			.toPromise();
	}

	// getAll(
	// 	relations: string[],
	// 	findInput?: OrganizationProjectsFindInput
	// ): Promise<{ items: any[]; total: number }> {
	// 	const data = JSON.stringify({ relations, findInput });

	// 	return this.http
	// 		.get<{ items: OrganizationProjects[]; total: number }>(
	// 			`/api/invites`,
	// 			{
	// 				params: { data }
	// 			}
	// 		)
	// 		.pipe(first())
	// 		.toPromise();
	// }

	// update(id: string, updateInput: any): Promise<any> {
	// 	return this.http
	// 		.put(`/api/organization-projects/${id}`, updateInput)
	// 		.pipe(first())
	// 		.toPromise();
	// }

	// delete(id: string): Promise<any> {
	// 	return this.http
	// 		.delete(`/api/organization-projects/${id}`)
	// 		.pipe(first())
	// 		.toPromise();
	// }
}
