import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import {
	ChatInteractionStatusEnum,
	ChatMessageKindEnum,
	ID,
	IChatEvent,
	IChatInteraction,
	IChatInteractionCallback,
	IChatInteractionInput,
	IChatInteractionResult
} from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { ChatConversation } from '../entities/chat-conversation.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatWebhook } from '../entities/chat-webhook.entity';
import { ChatWebhookInteraction } from '../entities/chat-webhook-interaction.entity';
import { ChatAccessService, IChatCaller } from '../services/chat-access.service';
import { authorDisplayName } from '../services/chat-notifier.service';
import { ChatMessageService } from '../services/chat-message.service';
import { ChatAppMessageWriter } from './chat-app-message.writer';
import { CHAT_INTERACTION_RETRY_DELAYS_MS, ChatInteractionAttempt, ChatInteractionTransport, signedCallback } from './chat-interaction-transport';
import { blocksOf, ChatWebhookPayloadError, findButton, normalizeInteractionReply } from './chat-webhook-payload';
import { ChatWebhookSecretBox, ChatWebhookSecretError } from './chat-webhook-secret-box';
import { isChatWebhooksEnabled } from './chat-webhooks-enabled';

/** An interaction as the routes answer it. */
export function interactionView(row: ChatWebhookInteraction): IChatInteraction {
	return {
		interactionId: row.id as ID,
		messageId: row.messageId,
		conversationId: row.conversationId,
		actionId: row.actionId,
		status: row.status,
		attempts: row.attempts ?? 0,
		replyApplied: !!row.replyAppliedAt,
		error: row.lastError ?? null,
		createdAt: row.createdAt
	};
}

/** Everything one callback needs, read once at the click (the retries run outside the request). */
interface ICallbackContext {
	interaction: ChatWebhookInteraction;
	webhook: ChatWebhook;
	message: ChatMessage;
	payload: IChatInteractionCallback;
	secret: string;
}

/**
 * Button clicks on app messages: a member clicks, the platform posts a signed callback to the webhook's interaction
 * URL, and the sender's reply (if any) replaces the message.
 *
 * - The click must come from someone who can read the message (404 otherwise, the chat access rule); the button is
 *   looked up in the stored blocks, and its stored value is what is sent — never a value from the client.
 * - One `chat_webhook_interaction` row per click: its id is the `interactionId` the callback carries, with the same
 *   `Idempotency-Key`, on the first attempt and on each of the three retries (each signed with a fresh timestamp).
 * - The first attempt runs inline (a 5 s deadline), the retries after the answer (2 s, 10 s, 30 s). A 2xx reply with
 *   content replaces the message once per interaction (`replyAppliedAt`, a compare-and-set).
 */
@Injectable()
export class ChatInteractionService implements OnModuleDestroy {
	private readonly logger = new Logger(ChatInteractionService.name);
	private readonly box = new ChatWebhookSecretBox();
	private readonly timers = new Set<NodeJS.Timeout>();
	/** Spec seam: the retry delays. */
	retryDelaysMs: readonly number[] = CHAT_INTERACTION_RETRY_DELAYS_MS;

	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChatAccessService,
		private readonly messages: ChatMessageService,
		private readonly writer: ChatAppMessageWriter,
		private readonly transport: ChatInteractionTransport
	) {}

	onModuleDestroy(): void {
		for (const timer of this.timers) clearTimeout(timer);
		this.timers.clear();
	}

	async interact(caller: IChatCaller & { employeeId: ID }, messageId: ID, input: IChatInteractionInput): Promise<IChatInteractionResult> {
		if (!isChatWebhooksEnabled()) throw new NotFoundException('The requested record was not found');
		const message = await this.dataSource.getRepository(ChatMessage).findOne({ where: { id: messageId, tenantId: caller.tenantId } });
		if (!message) throw new NotFoundException('The requested record was not found');
		const { conversation } = await this.access.requireMember(message.conversationId, caller);
		if (message.kind !== ChatMessageKindEnum.APP || !message.webhookId) throw new NotFoundException('The requested record was not found');
		const found = findButton(blocksOf(message.blocks), String(input.actionId ?? ''), input.blockId ?? null);
		if (!found) throw new NotFoundException('The requested record was not found');
		if (found.button.url) throw new BadRequestException('This button opens a link; it calls nobody back.');
		if (conversation.archivedAt) throw new BadRequestException('This conversation is archived.');
		const webhook = await this.dataSource.getRepository(ChatWebhook).findOne({ where: { id: message.webhookId, tenantId: caller.tenantId } });
		if (!webhook || webhook.revokedAt || !webhook.interactionUrl || !webhook.signingSecret) {
			throw new ConflictException('This app does not take interactions.');
		}
		let secret: string;
		try {
			secret = this.box.open(webhook.signingSecret, webhook.id as ID);
		} catch (error) {
			if (error instanceof ChatWebhookSecretError) throw new ConflictException(error.message);
			throw error;
		}

		const repository = this.dataSource.getRepository(ChatWebhookInteraction);
		const interaction = (await repository.save(
			repository.create({
				webhookId: webhook.id as ID,
				messageId: message.id as ID,
				conversationId: message.conversationId,
				actorEmployeeId: caller.employeeId,
				actorUserId: caller.userId,
				actionId: found.button.actionId,
				blockId: found.blockId,
				value: found.button.value ?? null,
				status: ChatInteractionStatusEnum.PENDING,
				attempts: 0,
				lastStatusCode: 0,
				tenantId: caller.tenantId,
				organizationId: message.organizationId ?? caller.organizationId ?? undefined
			} as never)
		)) as unknown as ChatWebhookInteraction;

		const user = RequestContext.currentUser();
		const payload: IChatInteractionCallback = {
			type: 'block_actions',
			interactionId: interaction.id as ID,
			actionAt: (interaction.createdAt ?? new Date()).toISOString(),
			webhook: { id: webhook.id as ID, name: webhook.name },
			conversation: { id: conversation.id as ID, name: conversation.name ?? null },
			message: { id: message.id as ID, createdAt: message.createdAt ? new Date(message.createdAt).toISOString() : null },
			// Who clicked: the employee id and the display name, nothing else of theirs (no e-mail, no user id).
			actor: { employeeId: caller.employeeId, name: authorDisplayName(user ? { firstName: user.firstName, lastName: user.lastName, name: user.name } : null) },
			action: { actionId: found.button.actionId, blockId: found.blockId, value: found.button.value ?? null, text: found.button.text }
		};
		const context: ICallbackContext = { interaction, webhook, message, payload, secret };
		const events = await this.attempt(context, 1);
		const [withRelations] = context.interaction.replyAppliedAt ? await this.messages.withRelations(caller, [context.message]) : [];
		return { interaction: interactionView(context.interaction), ...(withRelations ? { message: withRelations } : {}), events };
	}

	/** The state of a click, for the person who clicked. */
	async state(caller: IChatCaller, interactionId: ID): Promise<IChatInteraction> {
		if (!isChatWebhooksEnabled()) throw new NotFoundException('The requested record was not found');
		const row = await this.dataSource
			.getRepository(ChatWebhookInteraction)
			.findOne({ where: { id: interactionId, tenantId: caller.tenantId, actorUserId: caller.userId } });
		if (!row) throw new NotFoundException('The requested record was not found');
		return interactionView(row);
	}

	/** One attempt (1-based): posts, records the outcome, applies a reply, schedules the next attempt. */
	private async attempt(context: ICallbackContext, attempt: number): Promise<IChatEvent[]> {
		const { interaction, webhook } = context;
		const { headers, body } = signedCallback(context.secret, interaction.id as ID, attempt, context.payload);
		let result: ChatInteractionAttempt;
		try {
			result = await this.transport.post(webhook.interactionUrl as string, headers, body);
		} catch (error) {
			result = { outcome: 'retry', status: 0, error: 'unreachable' };
			this.logger.warn(`Interaction ${interaction.id} attempt ${attempt} failed: ${(error as Error)?.message}`);
		}
		const repository = this.dataSource.getRepository(ChatWebhookInteraction);
		interaction.attempts = attempt;
		interaction.lastStatusCode = result.status;
		if (result.outcome === 'delivered') {
			interaction.status = ChatInteractionStatusEnum.DELIVERED;
			interaction.deliveredAt = new Date();
			interaction.lastError = null;
			await repository.update({ id: interaction.id as ID }, { status: interaction.status, attempts: attempt, lastStatusCode: result.status, deliveredAt: interaction.deliveredAt, lastError: null } as never);
			return this.applyReply(context, result.body);
		}
		const last = attempt > this.retryDelaysMs.length;
		const failed = result.outcome === 'refused' || last;
		interaction.status = failed ? ChatInteractionStatusEnum.FAILED : ChatInteractionStatusEnum.RETRYING;
		interaction.lastError = result.error;
		await repository.update({ id: interaction.id as ID }, { status: interaction.status, attempts: attempt, lastStatusCode: result.status, lastError: result.error } as never);
		if (result.outcome === 'refused') {
			this.logger.warn(`Interaction ${interaction.id} of webhook ${webhook.id} was refused (${result.error}); not retried.`);
		}
		if (failed) {
			void this.dataSource
				.getRepository(ChatWebhook)
				.increment({ id: webhook.id as ID }, 'callbackFailureCount', 1)
				.catch(() => undefined);
			return [];
		}
		this.schedule(context, attempt + 1, this.retryDelaysMs[attempt - 1]);
		return [];
	}

	private schedule(context: ICallbackContext, attempt: number, delayMs: number): void {
		const timer = setTimeout(() => {
			this.timers.delete(timer);
			void this.retry(context, attempt);
		}, delayMs);
		timer.unref?.();
		this.timers.add(timer);
	}

	/** A retry: only while the webhook still takes interactions (a revoke stops the retries). */
	private async retry(context: ICallbackContext, attempt: number): Promise<void> {
		try {
			const webhook = await this.dataSource.getRepository(ChatWebhook).findOne({ where: { id: context.webhook.id as ID } });
			if (!webhook || webhook.revokedAt || !webhook.interactionUrl || !webhook.signingSecret) {
				await this.dataSource
					.getRepository(ChatWebhookInteraction)
					.update({ id: context.interaction.id as ID }, { status: ChatInteractionStatusEnum.FAILED, lastError: 'webhook_revoked' } as never);
				return;
			}
			// The secret as it is now: a rotation between two attempts signs the next one with the new secret.
			if (webhook.signingSecret !== context.webhook.signingSecret) {
				context.secret = this.box.open(webhook.signingSecret, webhook.id as ID);
			}
			context.webhook = webhook;
			await this.attempt(context, attempt);
		} catch (error) {
			// A retry that cannot run (the secret no longer opens, the database refused) ends the interaction as failed,
			// never as retrying for good.
			this.logger.warn(`Interaction ${context.interaction.id} retry ${attempt} failed: ${(error as Error)?.message}`);
			await this.dataSource
				.getRepository(ChatWebhookInteraction)
				.update({ id: context.interaction.id as ID }, { status: ChatInteractionStatusEnum.FAILED, lastError: error instanceof ChatWebhookSecretError ? 'secret_unreadable' : 'retry_failed' } as never)
				.catch(() => undefined);
		}
	}

	/**
	 * Applies the sender's reply to the message, at most once per interaction: a compare-and-set on `replyAppliedAt`
	 * decides which attempt (of a retried callback whose earlier answer was lost) gets to apply it.
	 */
	private async applyReply(context: ICallbackContext, raw: Buffer): Promise<IChatEvent[]> {
		const text = raw.toString('utf8').trim();
		if (!text.startsWith('{')) return [];
		let content;
		try {
			content = normalizeInteractionReply(JSON.parse(text), { canBroadcast: !!context.webhook.canBroadcast });
		} catch (error) {
			if (!(error instanceof ChatWebhookPayloadError) && !(error instanceof SyntaxError)) throw error;
			await this.dataSource
				.getRepository(ChatWebhookInteraction)
				.update({ id: context.interaction.id as ID }, { lastError: error instanceof ChatWebhookPayloadError ? `reply_${error.code}` : 'reply_not_json' } as never);
			return [];
		}
		if (!content) return [];
		const appliedAt = new Date();
		const claim = await this.dataSource
			.getRepository(ChatWebhookInteraction)
			.update({ id: context.interaction.id as ID, replyAppliedAt: IsNull() }, { replyAppliedAt: appliedAt } as never);
		if (!(claim.affected ?? 0)) return [];
		context.interaction.replyAppliedAt = appliedAt;
		const fresh = await this.dataSource.getRepository(ChatMessage).findOne({ where: { id: context.message.id as ID } });
		if (!fresh) return [];
		const conversation = await this.dataSource.getRepository(ChatConversation).findOne({ select: { id: true, archivedAt: true }, where: { id: fresh.conversationId } });
		if (conversation?.archivedAt) return [];
		const { message, events } = await this.writer.replace(fresh, content);
		context.message = message;
		return events;
	}
}
