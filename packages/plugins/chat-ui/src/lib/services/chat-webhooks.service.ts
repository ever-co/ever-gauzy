import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
	ID,
	IChatInteraction,
	IChatInteractionResult,
	IChatMessagePage,
	IChatMessageWithRelations,
	IChatWebhook,
	IChatWebhookCreateInput,
	IChatWebhookUpdateInput,
	IChatWebhookWriteResult
} from '@gauzy/contracts';
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

	/**
	 * Clicks a button of an app message; the app's reply, if any, comes back as the message. `idempotencyKey` (a UUID per
	 * click, the same on each retry of it) goes in the `Idempotency-Key` header: the API answers a repeat of it with the
	 * first click and calls the app no second time.
	 */
	interact(messageId: ID, actionId: string, blockId?: string | null, idempotencyKey?: string): Observable<IChatInteractionResult> {
		return this.http.post<IChatInteractionResult>(
			`${CHAT}/messages/${path(messageId)}/interactions`,
			blockId ? { actionId, blockId } : { actionId },
			idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}
		);
	}

	/** The state of one of my clicks (while its callback is retried). */
	interaction(interactionId: ID): Observable<IChatInteraction> {
		return this.http.get<IChatInteraction>(`${CHAT}/interactions/${path(interactionId)}`);
	}

	/**
	 * A message as it is now (after an app's reply replaced it on a retried callback): the timeline window around it,
	 * which always holds the message itself. Null when it is not there any more.
	 */
	message(conversationId: ID, messageId: ID): Observable<IChatMessageWithRelations | null> {
		return this.http
			.get<IChatMessagePage>(`${CHAT}/conversations/${path(conversationId)}/messages`, { params: { around: String(messageId), limit: '1' } })
			.pipe(map((page) => page.messages.find((message) => String(message.id) === String(messageId)) ?? null));
	}
}
