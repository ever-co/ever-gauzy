import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
	IAiChatConfig,
	IAiProviderCredential,
	IAiProviderCredentialCreateInput,
	IAiProviderCredentialUpdateInput,
	ID,
	IPagination
} from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';

/**
 * AiChatSettingsService
 *
 * Thin HttpClient wrapper around the `@gauzy/plugin-ai-chat` backend endpoints
 * used by the per-tenant "AI Providers" (BYOK) settings page:
 *
 * - `GET    /api/ai-chat/config`           — registered providers + configuration status
 * - `GET    /api/ai-chat/credentials`      — tenant credentials (API keys masked)
 * - `POST   /api/ai-chat/credentials`      — upsert per (tenant, provider)
 * - `PUT    /api/ai-chat/credentials/:id`  — update (omitted `apiKey` keeps the stored key)
 * - `DELETE /api/ai-chat/credentials/:id`  — delete
 *
 * Auth headers are attached by the app's HTTP interceptors — same convention
 * as the other plugin calls (see `provide-ai-chat-sidebar.ts`).
 */
@Injectable({ providedIn: 'root' })
export class AiChatSettingsService {
	/** Base URL of the AI chat backend plugin API. */
	private readonly API_URL = `${environment.API_BASE_URL}/api/ai-chat`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Retrieves the AI chat runtime configuration for the current tenant:
	 * registered providers, their models and configuration status.
	 *
	 * @returns An observable emitting the {@link IAiChatConfig}.
	 */
	getConfig(): Observable<IAiChatConfig> {
		return this.http.get<IAiChatConfig>(`${this.API_URL}/config`);
	}

	/**
	 * Retrieves the current tenant's AI provider credentials.
	 * API keys are always masked (e.g. `'••••abcd'`).
	 *
	 * @returns An observable emitting a paginated list of credentials.
	 */
	getCredentials(): Observable<IPagination<IAiProviderCredential>> {
		return this.http.get<IPagination<IAiProviderCredential>>(`${this.API_URL}/credentials`);
	}

	/**
	 * Creates or updates (upserts) the tenant's credential for a provider —
	 * one credential per provider per tenant. The `apiKey` is required on
	 * first create and is stored encrypted by the backend.
	 *
	 * @param input - The credential payload.
	 * @returns An observable emitting the persisted credential (API key masked).
	 */
	upsertCredential(input: IAiProviderCredentialCreateInput): Observable<IAiProviderCredential> {
		return this.http.post<IAiProviderCredential>(`${this.API_URL}/credentials`, input);
	}

	/**
	 * Updates an existing credential by its ID. An omitted `apiKey` keeps
	 * the currently stored (encrypted) key.
	 *
	 * @param id - The credential UUID.
	 * @param input - The fields to update.
	 * @returns An observable emitting the updated credential (API key masked).
	 */
	updateCredential(id: ID, input: IAiProviderCredentialUpdateInput): Observable<IAiProviderCredential> {
		return this.http.put<IAiProviderCredential>(`${this.API_URL}/credentials/${id}`, input);
	}

	/**
	 * Deletes a credential by its ID.
	 *
	 * @param id - The credential UUID.
	 * @returns An observable that completes when the credential is deleted.
	 */
	deleteCredential(id: ID): Observable<void> {
		return this.http.delete<void>(`${this.API_URL}/credentials/${id}`);
	}
}
