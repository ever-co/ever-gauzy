import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IAccountDeletionPreview, IAccountDeletionRequestInput, IAccountDeletionResult } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

/**
 * What `verify` answers. `planHash` identifies the accounts and outcomes it lists; `confirm` sends it back so the
 * API deletes exactly what the user reviewed (it answers 409 when that changed). Declared here as well as in the
 * contracts so this page compiles against either side of that API change.
 */
export type AccountDeletionPreview = IAccountDeletionPreview & { planHash?: string };

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

	verify(token: string): Promise<AccountDeletionPreview> {
		return firstValueFrom(this.http.post<AccountDeletionPreview>(`${API_PREFIX}/account-deletion/verify`, { token }));
	}

	/**
	 * Deletes what the preview identified by `planHash` listed. The API answers 409 when the accounts or their
	 * outcomes changed since that preview (nothing is deleted then), 410 when the link can no longer be used.
	 */
	confirm(token: string, planHash?: string): Promise<IAccountDeletionResult> {
		return firstValueFrom(
			this.http.post<IAccountDeletionResult>(`${API_PREFIX}/account-deletion/confirm`, {
				token,
				confirm: true,
				planHash
			})
		);
	}
}
