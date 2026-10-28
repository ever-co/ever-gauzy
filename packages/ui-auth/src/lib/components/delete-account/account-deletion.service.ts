import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	IAccountDeletionConfirmInput,
	IAccountDeletionPreview,
	IAccountDeletionRequestInput,
	IAccountDeletionResult
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

/**
 * The public account deletion API (`/api/account-deletion/*`): request a link by email, preview what it
 * deletes, confirm. None of these need (or use) a session.
 */
@Injectable()
export class AccountDeletionService {
	constructor(private readonly http: HttpClient) {}

	request(input: IAccountDeletionRequestInput): Promise<{ status: string }> {
		return firstValueFrom(this.http.post<{ status: string }>(`${API_PREFIX}/account-deletion/request`, input));
	}

	verify(token: string): Promise<IAccountDeletionPreview> {
		return firstValueFrom(this.http.post<IAccountDeletionPreview>(`${API_PREFIX}/account-deletion/verify`, { token }));
	}

	/**
	 * Deletes what the `verify` preview identified by `planHash` listed. The API answers 409 when the accounts or
	 * their outcomes changed since that preview (nothing is deleted then), 410 when the link can no longer be used.
	 */
	confirm(token: string, planHash: string): Promise<IAccountDeletionResult> {
		const body: IAccountDeletionConfirmInput = { token, confirm: true, planHash };
		return firstValueFrom(this.http.post<IAccountDeletionResult>(`${API_PREFIX}/account-deletion/confirm`, body));
	}
}
