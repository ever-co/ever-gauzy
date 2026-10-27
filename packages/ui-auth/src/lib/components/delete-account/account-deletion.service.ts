import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IAccountDeletionPreview, IAccountDeletionRequestInput, IAccountDeletionResult } from '@gauzy/contracts';
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

	confirm(token: string): Promise<IAccountDeletionResult> {
		return firstValueFrom(
			this.http.post<IAccountDeletionResult>(`${API_PREFIX}/account-deletion/confirm`, { token, confirm: true })
		);
	}
}
