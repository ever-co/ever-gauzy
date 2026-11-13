import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull, ObjectLiteral } from 'typeorm';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	CHAT_WEBHOOK_MAX_PER_CONVERSATION,
	CHAT_WEBHOOK_NAME_MAX_LENGTH,
	ChatConversationKindEnum,
	FeatureEnum,
	ID,
	IChatWebhook,
	IChatWebhookCreateInput,
	IChatWebhookUpdateInput,
	IChatWebhookWriteResult
} from '@gauzy/contracts';
import { gauzyToggleFeatures } from '@gauzy/config';
import { ActivityLogService } from '@gauzy/core';
import { getUnsafeOutboundUrlReason } from '@gauzy/utils';
import { CHAT_ROUTE_PREFIX } from '../chat.constants';
import { ChatConversation } from '../entities/chat-conversation.entity';
import { ChatWebhook } from '../entities/chat-webhook.entity';
import { inWriteTransaction } from '../realtime/chat-write-transaction';
import { ChatAccessService, IChatCaller } from '../services/chat-access.service';
import { ChatAppMessageWriter } from './chat-app-message.writer';
import { interactionUrlRefusal } from './chat-interaction-transport';
import { assertPayloadSize, ChatWebhookPayloadError, ChatWebhookPayloadErrorCode, normalizeWebhookPayload, payloadObjectOf, plainText } from './chat-webhook-payload';
import { ChatWebhookRateLimiter } from './chat-webhook-rate-limiter';
import { ChatWebhookSecretBox, ChatWebhookSecretError } from './chat-webhook-secret-box';
import { isWebhookTokenShaped, newSigningSecret, newWebhookToken, webhookTokenHash, webhookTokenHint } from './chat-webhook-token';
import { isChatWebhooksEnabled } from './chat-webhooks-enabled';

/** The answer of the receive route: the status and its plain-text body (a code a sender can match on). */
export type ChatWebhookReceipt =
	| { status: 200; body: 'ok' }
	| { status: 404; body: 'no_webhook' }
	| { status: 410; body: 'channel_is_archived' }
	| { status: 422; body: ChatWebhookPayloadErrorCode }
	| { status: 429; body: 'rate_limited'; retryAfterSeconds: number };

/** The path a webhook is posted to, under the API's `/api` prefix. */
export function webhookPath(token: string): string {
	return `/api/${CHAT_ROUTE_PREFIX}/hooks/${token}`;
}

/** The URL a sender posts to: the API's public base URL (`API_BASE_URL`) and the webhook path. */
export function webhookUrl(token: string, env: Record<string, string | undefined> = process.env): string {
	const base = String(env['API_BASE_URL'] || 'http://localhost:3000').replace(/\/+$/, '');
	return `${base}${webhookPath(token)}`;
}

/** A webhook as the management routes answer it: never its URL secret's hash or its signing secret. */
export function webhookView(webhook: ChatWebhook): IChatWebhook {
	return {
		id: webhook.id as ID,
		tenantId: webhook.tenantId,
		organizationId: webhook.organizationId,
		createdAt: webhook.createdAt,
		updatedAt: webhook.updatedAt,
		conversationId: webhook.conversationId,
		name: webhook.name,
		iconUrl: webhook.iconUrl ?? null,
		interactionUrl: webhook.interactionUrl ?? null,
		tokenHint: webhook.tokenHint,
		hasSigningSecret: !!webhook.signingSecret,
		canBroadcast: !!webhook.canBroadcast,
		createdByEmployeeId: webhook.createdByEmployeeId ?? null,
		createdByUserId: webhook.createdByUserId ?? undefined,
		revokedAt: webhook.revokedAt ?? null,
		revokedByEmployeeId: webhook.revokedByEmployeeId ?? null,
		lastUsedAt: webhook.lastUsedAt ?? null,
		acceptedCount: webhook.acceptedCount ?? 0,
		rejectedCount: webhook.rejectedCount ?? 0,
		rateLimitedCount: webhook.rateLimitedCount ?? 0,
		callbackFailureCount: webhook.callbackFailureCount ?? 0
	};
}

/**
 * Incoming webhooks: the management of a channel's webhooks (its managers, its creator and `CHAT_MANAGE` holders)
 * and the receive side of the public route.
 *
 * Every management route answers 404 for a conversation the caller is not in (the access rules of chat) and 403 for
 * a member who does not manage it. A webhook belongs to a channel: a direct or group conversation never has one.
 */
@Injectable()
export class ChatWebhookService {
	private readonly logger = new Logger(ChatWebhookService.name);
	private readonly box = new ChatWebhookSecretBox();

	constructor(
		private readonly dataSource: DataSource,
		private readonly access: ChatAccessService,
		private readonly writer: ChatAppMessageWriter,
		private readonly limiter: ChatWebhookRateLimiter,
		@Optional() private readonly activityLog?: ActivityLogService
	) {}

	// ---------------------------------------------------------------- management

	async list(caller: IChatCaller, conversationId: ID): Promise<IChatWebhook[]> {
		this.requireEnabled();
		await this.access.requireManager(conversationId, caller);
		const rows = await this.dataSource.getRepository(ChatWebhook).find({
			where: { conversationId, tenantId: caller.tenantId },
			order: { createdAt: 'DESC' }
		});
		return rows.map(webhookView);
	}

	async create(caller: IChatCaller, conversationId: ID, input: IChatWebhookCreateInput): Promise<IChatWebhookWriteResult> {
		this.requireEnabled();
		const { conversation } = await this.access.requireManager(conversationId, caller);
		if (conversation.kind !== ChatConversationKindEnum.CHANNEL) {
			throw new BadRequestException('Webhooks post to channels only.');
		}
		if (conversation.archivedAt) throw new BadRequestException('This conversation is archived.');
		const name = this.validName(input.name);
		const iconUrl = this.validIconUrl(input.iconUrl);
		const interactionUrl = await this.validInteractionUrl(input.interactionUrl);
		const id = randomUUID() as ID;
		// A signing secret whenever one can be stored, so an interaction URL can be set later without a second step.
		if (interactionUrl && !this.box.usable()) throw new BadRequestException(new ChatWebhookSecretError(this.box.problem() ?? 'no_secret').message);
		const signingSecret = this.box.usable() ? newSigningSecret() : undefined;
		const token = newWebhookToken();
		// The count and the insert under the conversation's row lock (Postgres, MySQL; SQLite has one writer at a time):
		// two creates at nine active webhooks cannot both pass the count.
		const saved = await inWriteTransaction(this.dataSource, async (manager) => {
			if (this.locksRows()) {
				await manager.getRepository(ChatConversation).findOne({ select: { id: true }, where: { id: conversationId }, lock: { mode: 'pessimistic_write' } });
			}
			const active = await manager.getRepository(ChatWebhook).count({ where: { conversationId, tenantId: caller.tenantId, revokedAt: IsNull() } });
			if (active >= CHAT_WEBHOOK_MAX_PER_CONVERSATION) {
				throw new BadRequestException(`A channel has at most ${CHAT_WEBHOOK_MAX_PER_CONVERSATION} webhooks; revoke one first.`);
			}
			const repository = manager.getRepository(ChatWebhook);
			return repository.save(
				repository.create({
					id,
					conversationId,
					name,
					iconUrl,
					interactionUrl,
					tokenHash: webhookTokenHash(token),
					tokenHint: webhookTokenHint(token),
					signingSecret: signingSecret ? this.box.seal(signingSecret, id) : null,
					canBroadcast: !!input.canBroadcast,
					createdByEmployeeId: caller.employeeId ?? null,
					createdByUserId: caller.userId,
					acceptedCount: 0,
					rejectedCount: 0,
					rateLimitedCount: 0,
					callbackFailureCount: 0,
					tenantId: caller.tenantId,
					organizationId: conversation.organizationId ?? caller.organizationId ?? undefined
				} as never)
			);
		});
		const webhook = saved as unknown as ChatWebhook;
		this.log(ActionTypeEnum.Created, webhook, { conversationId, name, iconUrl, interactionUrl, canBroadcast: !!input.canBroadcast });
		return { webhook: webhookView(webhook), url: webhookUrl(token), ...(signingSecret ? { signingSecret } : {}) };
	}

	async update(caller: IChatCaller, webhookId: ID, input: IChatWebhookUpdateInput): Promise<IChatWebhookWriteResult> {
		this.requireEnabled();
		const webhook = await this.webhookForManager(caller, webhookId);
		if (webhook.revokedAt) throw new BadRequestException('A revoked webhook cannot be changed.');
		const before = { name: webhook.name, iconUrl: webhook.iconUrl ?? null, interactionUrl: webhook.interactionUrl ?? null, canBroadcast: !!webhook.canBroadcast };
		// Only the fields the request names are written: two managers changing different fields at once keep both changes.
		const changes: Partial<typeof before> = {};
		if (input.name !== undefined) changes.name = this.validName(input.name);
		if (input.iconUrl !== undefined) changes.iconUrl = this.validIconUrl(input.iconUrl);
		if (input.interactionUrl !== undefined) changes.interactionUrl = await this.validInteractionUrl(input.interactionUrl);
		if (input.canBroadcast !== undefined) changes.canBroadcast = !!input.canBroadcast;
		const after = { ...before, ...changes };
		let signingSecret: string | undefined;
		if (after.interactionUrl && !webhook.signingSecret) {
			if (!this.box.usable()) throw new BadRequestException(new ChatWebhookSecretError(this.box.problem() ?? 'no_secret').message);
			signingSecret = newSigningSecret();
		}
		const sealed = signingSecret ? this.box.seal(signingSecret, webhook.id as ID) : null;
		await this.dataSource
			.getRepository(ChatWebhook)
			.update({ id: webhook.id as ID, tenantId: caller.tenantId }, { ...changes, ...(sealed ? { signingSecret: sealed } : {}) } as never);
		const changed = Object.assign(webhook, after, sealed ? { signingSecret: sealed } : {});
		this.log(ActionTypeEnum.Updated, changed, after, before);
		return { webhook: webhookView(changed), ...(signingSecret ? { signingSecret } : {}) };
	}

	async rotateSecret(caller: IChatCaller, webhookId: ID): Promise<IChatWebhookWriteResult> {
		this.requireEnabled();
		const webhook = await this.webhookForManager(caller, webhookId);
		if (webhook.revokedAt) throw new BadRequestException('A revoked webhook cannot be changed.');
		if (!this.box.usable()) throw new BadRequestException(new ChatWebhookSecretError(this.box.problem() ?? 'no_secret').message);
		const hadSecret = !!webhook.signingSecret;
		const signingSecret = newSigningSecret();
		const sealed = this.box.seal(signingSecret, webhook.id as ID);
		await this.dataSource.getRepository(ChatWebhook).update({ id: webhook.id as ID, tenantId: caller.tenantId }, { signingSecret: sealed } as never);
		webhook.signingSecret = sealed;
		this.log(ActionTypeEnum.Updated, webhook, { signingSecret: 'rotated' }, { signingSecret: hadSecret ? 'set' : 'none' });
		return { webhook: webhookView(webhook), signingSecret };
	}

	/** Revokes a webhook: its URL answers 404 from now on, its buttons call nobody back; the row stays. */
	async revoke(caller: IChatCaller, webhookId: ID): Promise<IChatWebhookWriteResult> {
		this.requireEnabled();
		const webhook = await this.webhookForManager(caller, webhookId);
		if (webhook.revokedAt) return { webhook: webhookView(webhook) };
		const revokedAt = new Date();
		await this.dataSource
			.getRepository(ChatWebhook)
			.update({ id: webhook.id as ID, tenantId: caller.tenantId, revokedAt: IsNull() }, { revokedAt, revokedByEmployeeId: caller.employeeId ?? null } as never);
		webhook.revokedAt = revokedAt;
		webhook.revokedByEmployeeId = caller.employeeId ?? undefined;
		this.log(ActionTypeEnum.Deleted, webhook, { conversationId: webhook.conversationId, name: webhook.name });
		return { webhook: webhookView(webhook) };
	}

	// ---------------------------------------------------------------- receive

	/**
	 * A sender's post: the webhook its URL secret names, then its channel, the limits and the payload. Never throws for
	 * a refusal: the route answers the receipt as it is (a plain-text code a sender can match on).
	 */
	async receive(token: unknown, body: unknown, rawLength: number, idempotencyKey?: string | null): Promise<ChatWebhookReceipt> {
		if (!isChatWebhooksEnabled() || !isWebhookTokenShaped(token)) return { status: 404, body: 'no_webhook' };
		const webhook = await this.dataSource.getRepository(ChatWebhook).findOne({ where: { tokenHash: webhookTokenHash(token) } });
		if (!webhook || webhook.revokedAt) return { status: 404, body: 'no_webhook' };
		const conversation = await this.dataSource
			.getRepository(ChatConversation)
			.findOne({ where: { id: webhook.conversationId, tenantId: webhook.tenantId as ID } });
		// A webhook only ever posts to its own channel (never a direct or group conversation, FR-8), of a tenant that has
		// chat on.
		if (!conversation || conversation.kind !== ChatConversationKindEnum.CHANNEL || !(await this.chatOnFor(webhook))) {
			return { status: 404, body: 'no_webhook' };
		}
		if (conversation.archivedAt) {
			this.count(webhook, 'rejectedCount');
			return { status: 410, body: 'channel_is_archived' };
		}
		const decision = await this.limiter.take(webhook.id as ID, String(webhook.organizationId ?? webhook.tenantId));
		// `=== false`, not `!`: the worker and API builds compile this plugin without strictNullChecks, where a truthiness
		// check does not narrow the decision to its refused member.
		if (decision.allowed === false) {
			this.count(webhook, 'rateLimitedCount');
			return { status: 429, body: 'rate_limited', retryAfterSeconds: decision.retryAfterSeconds };
		}
		let content;
		try {
			assertPayloadSize(rawLength);
			content = normalizeWebhookPayload(payloadObjectOf(body), { canBroadcast: !!webhook.canBroadcast, idempotencyKey });
		} catch (error) {
			if (!(error instanceof ChatWebhookPayloadError)) throw error;
			this.count(webhook, 'rejectedCount');
			return { status: 422, body: error.code };
		}
		await this.writer.post(webhook, conversation, content);
		this.count(webhook, 'acceptedCount', true);
		return { status: 200, body: 'ok' };
	}

	// ---------------------------------------------------------------- helpers

	/** A webhook of the caller's tenant whose channel the caller manages; 404 otherwise (403 for a non-manager member). */
	async webhookForManager(caller: IChatCaller, webhookId: ID): Promise<ChatWebhook> {
		const webhook = await this.dataSource.getRepository(ChatWebhook).findOne({ where: { id: webhookId, tenantId: caller.tenantId } });
		if (!webhook) throw new NotFoundException('The requested record was not found');
		await this.access.requireManager(webhook.conversationId, caller);
		return webhook;
	}

	/** Whether the database takes row locks (`SELECT … FOR UPDATE`): Postgres and MySQL; SQLite serialises its writers. */
	private locksRows(): boolean {
		const type = String((this.dataSource as { options?: { type?: unknown } }).options?.type ?? '');
		return type === 'postgres' || type === 'mysql' || type === 'mariadb';
	}

	private requireEnabled(): void {
		if (!isChatWebhooksEnabled()) throw new NotFoundException('The requested record was not found');
	}

	private validName(raw: unknown): string {
		const name = plainText(typeof raw === 'string' ? raw.replace(/\s+/g, ' ') : '', CHAT_WEBHOOK_NAME_MAX_LENGTH + 1);
		if (!name) throw new BadRequestException('A webhook needs a name.');
		if (name.length > CHAT_WEBHOOK_NAME_MAX_LENGTH) throw new BadRequestException(`A webhook name holds at most ${CHAT_WEBHOOK_NAME_MAX_LENGTH} characters.`);
		return name;
	}

	/** An icon is shown by the clients, never fetched by the server: an https URL of a public host, judged on the URL. */
	private validIconUrl(raw: string | null | undefined): string | null {
		if (raw === null || raw === undefined || String(raw).trim() === '') return null;
		const url = String(raw).trim();
		if (getUnsafeOutboundUrlReason(url) !== null) throw new BadRequestException('The icon must be an https URL of a public host.');
		return url;
	}

	/** The interaction URL is called by the server: judged by the egress guard, its host resolved now. */
	private async validInteractionUrl(raw: string | null | undefined): Promise<string | null> {
		if (raw === null || raw === undefined || String(raw).trim() === '') return null;
		const url = String(raw).trim();
		const refusal = await interactionUrlRefusal(url);
		if (refusal) throw new BadRequestException(refusal);
		return url;
	}

	/**
	 * Whether the tenant has chat on (`FEATURE_CHAT`): the public route runs without the tenant guard, so the stored
	 * toggles are read here the way `FeatureService.isFeatureEnabled` reads them — the organization's own toggle first,
	 * then the tenant-wide one, then the deployment's configured state (`FEATURE_CHAT`). A read that fails refuses the
	 * post: chat may be off.
	 */
	private async chatOnFor(webhook: ChatWebhook): Promise<boolean> {
		const configured = !!gauzyToggleFeatures[FeatureEnum.FEATURE_CHAT];
		try {
			const feature = await this.dataSource.getRepository<ObjectLiteral>('Feature').findOne({ select: { id: true }, where: { code: FeatureEnum.FEATURE_CHAT } } as never);
			if (!feature) return configured;
			const toggles = await this.dataSource
				.getRepository<ObjectLiteral>('FeatureOrganization')
				.find({ select: { id: true, organizationId: true, isEnabled: true }, where: { featureId: feature['id'], tenantId: webhook.tenantId } } as never);
			const scoped =
				(webhook.organizationId ? toggles.find((toggle) => String(toggle['organizationId'] ?? '') === String(webhook.organizationId)) : undefined) ??
				toggles.find((toggle) => !toggle['organizationId']);
			return scoped ? scoped['isEnabled'] === true : configured;
		} catch (error) {
			this.logger.warn(`The chat feature toggle could not be read for a webhook post: ${(error as Error)?.message}`);
			return false;
		}
	}

	/** Bumps one of the webhook's counters (best effort, off the answer's path); `lastUsedAt` with an accepted post. */
	private count(webhook: ChatWebhook, column: 'acceptedCount' | 'rejectedCount' | 'rateLimitedCount' | 'callbackFailureCount', used = false): void {
		const repository = this.dataSource.getRepository(ChatWebhook);
		void repository
			.increment({ id: webhook.id as ID }, column, 1)
			.then(() => (used ? repository.update({ id: webhook.id as ID }, { lastUsedAt: new Date() } as never) : undefined))
			.catch((error) => this.logger.warn(`Webhook counter ${column} not updated: ${(error as Error)?.message}`));
	}

	private log(action: ActionTypeEnum, webhook: ChatWebhook, values: Record<string, unknown>, previous?: Record<string, unknown>): void {
		if (!this.activityLog) return;
		try {
			this.activityLog.logActivity(
				BaseEntityEnum.ChatWebhook,
				action,
				ActorTypeEnum.User,
				webhook.id as ID,
				webhook.name,
				{ ...values, conversationId: webhook.conversationId },
				webhook.organizationId as ID,
				webhook.tenantId as ID,
				previous,
				previous ? values : undefined
			);
		} catch (error) {
			this.logger.warn(`The activity log entry of webhook ${webhook.id} was not written: ${(error as Error)?.message}`);
		}
	}
}
