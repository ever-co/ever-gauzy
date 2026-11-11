import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ID, IChatInteraction, IChatInteractionResult, IChatWebhook, IChatWebhookCreateInput, IChatWebhookUpdateInput, IChatWebhookWriteResult } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

const CHAT = `${API_PREFIX}/chat`;
const path = (id: ID) => encodeURIComponent(String(id));

/**
 * The incoming-webhook routes of the chat API (`GAUZY_CHAT_WEBHOOKS_ENABLED` on the API). Where webhooks are off,
 * every one of them answers 404: the page then shows no Integrations tab, and app buttons stay inert.
 */
@Injectable({ providedIn: 'root' })
export class ChatWebhooksService {
	private readonly http = inject(HttpClient);

	/** The webhooks of a channel I manage, newest first (revoked ones included). */
	list(conversationId: ID): Observable<IChatWebhook[]> {
		return this.http.get<IChatWebhook[]>(`${CHAT}/conversations/${path(conversationId)}/webhooks`);
	}

	/** A new webhook: the answer holds its URL and its signing secret, shown this once. */
	create(conversationId: ID, input: IChatWebhookCreateInput): Observable<IChatWebhookWriteResult> {
		return this.http.post<IChatWebhookWriteResult>(`${CHAT}/conversations/${path(conversationId)}/webhooks`, input);
	}

	update(webhookId: ID, input: IChatWebhookUpdateInput): Observable<IChatWebhookWriteResult> {
		return this.http.patch<IChatWebhookWriteResult>(`${CHAT}/webhooks/${path(webhookId)}`, input);
	}

	/** A new signing secret (shown this once). */
	rotateSecret(webhookId: ID): Observable<IChatWebhookWriteResult> {
		return this.http.post<IChatWebhookWriteResult>(`${CHAT}/webhooks/${path(webhookId)}/secret`, {});
	}

	/** Revokes a webhook: its URL answers 404 from now on. */
	revoke(webhookId: ID): Observable<IChatWebhookWriteResult> {
		return this.http.delete<IChatWebhookWriteResult>(`${CHAT}/webhooks/${path(webhookId)}`);
	}

	/** Clicks a button of an app message; the app's reply, if any, comes back as the message. */
	interact(messageId: ID, actionId: string, blockId?: string | null): Observable<IChatInteractionResult> {
		return this.http.post<IChatInteractionResult>(`${CHAT}/messages/${path(messageId)}/interactions`, blockId ? { actionId, blockId } : { actionId });
	}

	/** The state of one of my clicks (while its callback is retried). */
	interaction(interactionId: ID): Observable<IChatInteraction> {
		return this.http.get<IChatInteraction>(`${CHAT}/interactions/${path(interactionId)}`);
	}
}
