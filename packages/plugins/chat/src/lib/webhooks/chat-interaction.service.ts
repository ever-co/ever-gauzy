import { BadRequestException, ConflictException, HttpStatus, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource, In, LessThan } from 'typeorm';
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
import { ApiErrorCode, ApiException, isUniqueViolation, RequestContext } from '@gauzy/core';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatWebhook } from '../entities/chat-webhook.entity';
import { ChatWebhookInteraction } from '../entities/chat-webhook-interaction.entity';
import { ChatAccessService, IChatCaller } from '../services/chat-access.service';
import { authorDisplayName } from '../services/chat-notifier.service';
import { ChatMessageService } from '../services/chat-message.service';
import { ChatAppMessageWriter } from './chat-app-message.writer';
import { CHAT_INTERACTION_RETRY_DELAYS_MS, ChatInteractionAttempt, ChatInteractionTransport, signedCallback } from './chat-interaction-transport';
import { blocksOf, CHAT_WEBHOOK_MAX_NONCE_LENGTH, ChatWebhookPayloadError, findButton, isUsableIdempotencyKey, normalizeInteractionReply } from './chat-webhook-payload';
import { ChatWebhookSecretBox, ChatWebhookSecretError } from './chat-webhook-secret-box';
import { isChatWebhooksEnabled } from './chat-webhooks-enabled';

/** The header a click's idempotency key comes in (the receive route reads the same one). */
export const CHAT_INTERACTION_KEY_HEADER = 'Idempotency-Key';

/**
 * The idempotency key of a click, from its `Idempotency-Key` header: trimmed; none, or a blank one, is no key (every
 * request is then a click, as before keys existed). The receive route's rule: at most 64 printable characters.
 *
 * @throws ApiException 400 (`VALIDATION_FAILED`) for a key that cannot be stored.
 */
export function interactionKeyOf(raw: unknown): string | null {
	// A header sent twice arrives as an array: the first value is the one the client addressed to this request.
	const value = Array.isArray(raw) ? raw[0] : raw;
	if (typeof value !== 'string' || !value.trim()) return null;
	const key = value.trim();
	if (!isUsableIdempotencyKey(key)) {
		throw new ApiException(
			HttpStatus.BAD_REQUEST,
			ApiErrorCode.VALIDATION_FAILED,
			`The ${CHAT_INTERACTION_KEY_HEADER} header holds at most ${CHAT_WEBHOOK_MAX_NONCE_LENGTH} printable characters.`,
			{ field: CHAT_INTERACTION_KEY_HEADER.toLowerCase() }
		);
	}
	return key;
}

/**
 * Whether a request names the button an earlier click with its key clicked: the same action id, and the same block id
 * when it names one (a request without one named the button by its action id alone, as the first one may have).
 */
function isSameButton(row: Pick<ChatWebhookInteraction, 'actionId' | 'blockId'>, input: IChatInteractionInput): boolean {
	if (String(input.actionId ?? '') !== row.actionId) return false;
	return !input.blockId || input.blockId === (row.blockId ?? null);
}

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
 * - A click is one row however often it is sent: a client's `Idempotency-Key` (unique per tenant, message and clicker)
 *   names the first row again on a double click or a retry after a lost answer, which is answered as it is now and
 *   calls the app no second time; the same key for another button is refused (409). Without a key, every request is
 *   a click.
 * - The first attempt runs inline (a 5 s deadline), the retries after the answer (2 s, 10 s, 30 s). A 2xx reply with
 *   content replaces the message once per interaction (`replyAppliedAt`, a compare-and-set).
 */
@Injectable()
export class ChatInteractionService implements OnModuleInit, OnModuleDestroy {
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

	/**
	 * Retries run in the process that took the click (plan §12): an interaction a process left pending or retrying when
	 * it stopped would read as under way for good. On start, the ones untouched for longer than twice the whole retry
	 * schedule are marked failed (`process_restarted`); the recent ones may belong to another API process's retries.
	 */
	async onModuleInit(): Promise<void> {
		try {
			await this.dataSource.getRepository(ChatWebhookInteraction).update(
				{ status: In([ChatInteractionStatusEnum.PENDING, ChatInteractionStatusEnum.RETRYING]), updatedAt: LessThan(new Date(Date.now() - this.staleAfterMs())) } as never,
				{ status: ChatInteractionStatusEnum.FAILED, lastError: 'process_restarted' } as never
			);
		} catch (error) {
			// The table may not exist yet (a host that runs the migrations after the modules start): nothing to sweep.
			this.logger.debug(`Stale interactions were not swept: ${(error as Error)?.message}`);
		}
	}

	onModuleDestroy(): void {
		for (const timer of this.timers) clearTimeout(timer);
		this.timers.clear();
	}

	/**
	 * How long an interaction may stay pending or retrying before it counts as abandoned: twice the whole retry schedule
	 * (each attempt has a 5 s deadline). Every attempt touches the row, so a live retry, in any API process, is younger.
	 */
	private staleAfterMs(): number {
		return 2 * (5_000 + this.retryDelaysMs.reduce((total, delay) => total + delay + 5_000, 0));
	}

	/**
	 * A click. `idempotencyKey` is the request's `Idempotency-Key` header as it arrived (see `interactionKeyOf`).
	 */
	async interact(caller: IChatCaller & { employeeId: ID }, messageId: ID, input: IChatInteractionInput, idempotencyKey?: unknown): Promise<IChatInteractionResult> {
		if (!isChatWebhooksEnabled()) throw new NotFoundException('The requested record was not found');
		const key = interactionKeyOf(idempotencyKey);
		const message = await this.dataSource.getRepository(ChatMessage).findOne({ where: { id: messageId, tenantId: caller.tenantId } });
		if (!message) throw new NotFoundException('The requested record was not found');
		const { conversation, member } = await this.access.requireMember(message.conversationId, caller);
		// A click is a member's: a `CHAT_MANAGE` holder who reads a channel without being in it does not act in it.
		if (!member) throw new NotFoundException('The requested record was not found');
		if (message.kind !== ChatMessageKindEnum.APP || !message.webhookId) throw new NotFoundException('The requested record was not found');
		// A repeat of a click is answered before its button is looked up: the app's reply may have replaced the blocks
		// since, the channel may have been archived, the app revoked. The click was taken; nothing is sent again.
		if (key) {
			const earlier = await this.clickWithKey(caller, message.id as ID, key);
			if (earlier) return this.repeat(caller, earlier, message, input);
		}
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
		let interaction: ChatWebhookInteraction;
		try {
			interaction = (await repository.save(
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
					idempotencyKey: key,
					tenantId: caller.tenantId,
					organizationId: message.organizationId ?? caller.organizationId ?? undefined
				} as never)
			)) as unknown as ChatWebhookInteraction;
		} catch (error) {
			// Two requests with one key both got past the look-up (a double click, a retry sent while the first was under
			// way): the unique (tenant, message, clicker, key) index refused the second row. The first one's click is the
			// answer, and only it calls the app. `isUniqueViolation` reads the driver codes of every dialect, wrapped by
			// TypeORM or MikroORM alike; any other failure, or a winner that cannot be read, is raised as it is.
			const winner = key && isUniqueViolation(error) ? await this.clickWithKey(caller, message.id as ID, key) : null;
			if (!winner) throw error;
			return this.repeat(caller, winner, message, input);
		}

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

	/**
	 * The state of a click, for the person who clicked. One still pending or retrying long after its whole retry
	 * schedule lost its retries (its API process restarted after the start-up sweep's cut-off): it is marked failed
	 * (`process_restarted`) here, so the clicker is not told it is under way for good.
	 */
	async state(caller: IChatCaller, interactionId: ID): Promise<IChatInteraction> {
		if (!isChatWebhooksEnabled()) throw new NotFoundException('The requested record was not found');
		const row = await this.dataSource.getRepository(ChatWebhookInteraction).findOne({ where: { id: interactionId, tenantId: caller.tenantId, actorUserId: caller.userId } });
		if (!row) throw new NotFoundException('The requested record was not found');
		return interactionView(await this.current(row));
	}

	/** A click as it is now: one still under way long after its whole retry schedule is marked failed (see `state`). */
	private async current(row: ChatWebhookInteraction): Promise<ChatWebhookInteraction> {
		const underWay = row.status === ChatInteractionStatusEnum.PENDING || row.status === ChatInteractionStatusEnum.RETRYING;
		const touchedAt = row.updatedAt ?? row.createdAt;
		if (underWay && touchedAt && Date.now() - new Date(touchedAt).getTime() > this.staleAfterMs()) {
			await this.dataSource.getRepository(ChatWebhookInteraction).update(
				{ id: row.id as ID, status: In([ChatInteractionStatusEnum.PENDING, ChatInteractionStatusEnum.RETRYING]) } as never,
				{ status: ChatInteractionStatusEnum.FAILED, lastError: 'process_restarted' } as never
			);
			row.status = ChatInteractionStatusEnum.FAILED;
			row.lastError = 'process_restarted';
		}
		return row;
	}

	/** The click the caller made on a message with an idempotency key, if any (the key's unique index names one). */
	private clickWithKey(caller: IChatCaller, messageId: ID, key: string): Promise<ChatWebhookInteraction | null> {
		return this.dataSource.getRepository(ChatWebhookInteraction).findOne({ where: { tenantId: caller.tenantId, messageId, actorUserId: caller.userId, idempotencyKey: key } as never });
	}

	/**
	 * The answer to a repeated key: the click it names, as it is now (`current`), with the message when the app's reply
	 * replaced it, and no events (the first answer carried them, and the realtime stream told everyone). Nothing is sent
	 * to the app. A key names one click: the same key for another button is refused (409 `IDEMPOTENCY_KEY_REUSED`, as
	 * the platform's own idempotency answers a reused key), never merged.
	 *
	 * The message is read again once the reply is seen applied: the request read it before it read the click, and the
	 * first request may have applied the reply in between, so that copy can still hold the buttons the reply replaced.
	 */
	private async repeat(caller: IChatCaller, row: ChatWebhookInteraction, message: ChatMessage, input: IChatInteractionInput): Promise<IChatInteractionResult> {
		if (!isSameButton(row, input)) {
			throw new ApiException(HttpStatus.CONFLICT, ApiErrorCode.IDEMPOTENCY_KEY_REUSED, `This ${CHAT_INTERACTION_KEY_HEADER} was used for another button of the message.`, {
				field: CHAT_INTERACTION_KEY_HEADER.toLowerCase()
			});
		}
		const now = await this.current(row);
		const replied = now.replyAppliedAt ? await this.dataSource.getRepository(ChatMessage).findOne({ where: { id: message.id as ID, tenantId: caller.tenantId } }) : null;
		const [withRelations] = replied ? await this.messages.withRelations(caller, [replied]) : [];
		return { interaction: interactionView(now), ...(withRelations ? { message: withRelations } : {}), events: [], replayed: true };
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
			try {
				return await this.applyReply(context, result.body);
			} catch (error) {
				// The app ran the action: the click is delivered whatever happens to its reply. Retrying the callback would
				// not help, and a click sent again without its idempotency key would be a new interaction id: the app would
				// act twice.
				this.logger.warn(`The reply to interaction ${interaction.id} was not applied: ${(error as Error)?.message}`);
				interaction.lastError = 'reply_failed';
				await repository.update({ id: interaction.id as ID }, { lastError: 'reply_failed' } as never).catch(() => undefined);
				return [];
			}
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
	 * Applies the sender's reply to the message, at most once per interaction: the writer claims `replyAppliedAt` (a
	 * compare-and-set) and changes the message in one transaction, so which attempt of a retried callback gets to apply
	 * it is decided there, and the marker is never set for a message that did not change.
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
		const replaced = await this.writer.replaceOnce(context.message.id as ID, context.interaction.id as ID, content);
		if (!replaced) return [];
		context.interaction.replyAppliedAt = replaced.message.editedAt ?? new Date();
		context.message = replaced.message;
		return replaced.events;
	}
}
