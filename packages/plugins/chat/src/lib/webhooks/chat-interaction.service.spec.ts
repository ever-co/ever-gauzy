/**
 * `ChatInteractionService`: a member's click on an app-message button — who may click (404 otherwise), what is sent
 * (the stored button value, the actor's id and name only, signed, the interaction id as `Idempotency-Key`), the
 * retries (three, signed afresh, the same interaction id), the reply applied at most once, and the client's
 * `Idempotency-Key` (one interaction and one callback per key, however often and however concurrently it is sent).
 *
 * `@gauzy/core` is doubled at the module boundary; its webhook signer and verifier, its `ApiException` and its
 * unique-violation reader are the real ones.
 */
const mockCurrentUser = jest.fn();
jest.mock('@gauzy/core', () => {
	const signature = jest.requireActual('../../../../../core/src/lib/webhook/webhook-signature');
	const errors = {
		...jest.requireActual('../../../../../core/src/lib/core/errors/api-error-codes'),
		...jest.requireActual('../../../../../core/src/lib/core/errors/api-exception'),
		...jest.requireActual('../../../../../core/src/lib/core/errors/unique-violation')
	};
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		signWebhookPayload: signature.signWebhookPayload,
		verifyWebhookSignature: signature.verifyWebhookSignature,
		ApiErrorCode: errors.ApiErrorCode,
		ApiException: errors.ApiException,
		isUniqueViolation: errors.isUniqueViolation,
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentUser: () => mockCurrentUser(), hasPermission: () => false }
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {
		return undefined;
	}) });
});

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { DataSource } from 'typeorm';
import { ChatAppBlockTypeEnum, ChatInteractionStatusEnum, ChatMessageKindEnum, WebhookHeader } from '@gauzy/contracts';
import { ApiErrorCode, ApiException, verifyWebhookSignature } from '@gauzy/core';
import { ChatAccessService, IChatCaller } from '../services/chat-access.service';
import { ChatMessageService } from '../services/chat-message.service';
import { ChatAppMessageWriter } from './chat-app-message.writer';
import { ChatInteractionAttempt, ChatInteractionTransport } from './chat-interaction-transport';
import { ChatInteractionService, interactionKeyOf } from './chat-interaction.service';
import { ChatWebhookSecretBox } from './chat-webhook-secret-box';

const KEY = Buffer.alloc(32, 5).toString('base64');
const member: IChatCaller & { employeeId: string } = { tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: false };
const BLOCKS = [
	{ type: ChatAppBlockTypeEnum.HEADER, text: 'CPU high' },
	{
		type: ChatAppBlockTypeEnum.ACTIONS,
		blockId: 'alert-7',
		elements: [
			{ actionId: 'ack', text: 'Acknowledge', value: 'alert-7', url: null, style: 'primary' },
			{ actionId: 'open', text: 'Open', value: null, url: 'https://monitor.example.com/7', style: null },
			{ actionId: 'snooze', text: 'Snooze', value: '1h', url: null, style: null }
		]
	}
];

/** The columns of the unique (tenant, message, clicker, key) index of migration `1791000008300`. */
const KEY_COLUMNS = ['tenantId', 'messageId', 'actorUserId', 'idempotencyKey'] as const;

/**
 * How each driver refuses the second row of a key, as the code that writes it receives the error: TypeORM wraps the
 * driver's error (`driverError`) for Postgres, MySQL and SQLite; MikroORM turns it into its own exception class.
 */
const UNIQUE_VIOLATIONS: Array<[string, () => Error]> = [
	['TypeORM on Postgres', () => Object.assign(new Error('duplicate key value violates unique constraint "UQ_chat_webhook_interaction_idempotency_key"'), { name: 'QueryFailedError', driverError: { code: '23505' } })],
	['TypeORM on MySQL', () => Object.assign(new Error("Duplicate entry 'ten-m1-u1-k' for key 'chat_webhook_interaction.UQ_chat_webhook_interaction_idempotency_key'"), { name: 'QueryFailedError', driverError: { code: 'ER_DUP_ENTRY', errno: 1062 } })],
	['TypeORM on SQLite', () => Object.assign(new Error('UNIQUE constraint failed: chat_webhook_interaction.tenantId, chat_webhook_interaction.messageId, chat_webhook_interaction.actorUserId, chat_webhook_interaction.idempotencyKey'), { name: 'QueryFailedError', driverError: { code: 'SQLITE_CONSTRAINT_UNIQUE' } })],
	['MikroORM', () => new UniqueConstraintViolationException(Object.assign(new Error('insert into "chat_webhook_interaction" … - duplicate key value violates unique constraint "UQ_chat_webhook_interaction_idempotency_key"'), { code: '23505' }))]
];

interface ISetup {
	message?: Record<string, unknown> | null;
	webhook?: Record<string, unknown> | null;
	attempts?: ChatInteractionAttempt[];
	notMember?: boolean;
	/** A `CHAT_MANAGE` holder reading a channel they are not in: the access rule answers no membership. */
	noMembership?: boolean;
	/** How the unique key index refuses a second row (TypeORM on Postgres by default). */
	uniqueViolation?: () => Error;
	/** Holds every save until this resolves (two requests then both look their key up before either writes). */
	saveGate?: Promise<unknown>;
}

/** Resolves `gate` once two requests have looked their key up: both then got past the look-up before either wrote. */
function openWhenBothLooked(findOne: jest.Mock, gate: { resolve: () => void }): void {
	const lookUp = findOne.getMockImplementation();
	if (!lookUp) throw new Error('The double has no look-up.');
	let lookups = 0;
	findOne.mockImplementation(async (query: { where: Record<string, unknown> }) => {
		const found = await lookUp(query);
		if (query.where['idempotencyKey'] && (lookups += 1) === 2) gate.resolve();
		return found;
	});
}

/** A promise and the function that resolves it. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve: () => void = () => undefined;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

function setup(options: ISetup = {}) {
	process.env['ENCRYPTION_KEY'] = KEY;
	const box = new ChatWebhookSecretBox();
	const message =
		options.message === null
			? null
			: { id: 'm1', tenantId: 'ten', organizationId: 'org', conversationId: 'c1', kind: ChatMessageKindEnum.APP, webhookId: 'w1', body: 'CPU high', blocks: JSON.stringify(BLOCKS), createdAt: new Date('2026-11-11T09:00:00Z'), ...options.message };
	const webhook =
		options.webhook === null
			? null
			: { id: 'w1', tenantId: 'ten', name: 'Monitor', interactionUrl: 'https://hooks.example.com/interact', signingSecret: box.seal('signing-secret', 'w1'), canBroadcast: false, revokedAt: null, ...options.webhook };
	const interactions: Record<string, unknown>[] = [];
	const interactionUpdates: Array<{ where: Record<string, unknown>; patch: Record<string, unknown> }> = [];
	const applied = new Set<string>();
	/** Every column a `where` names equals the row's (the doubles only ever ask by equality, or by `In` / `LessThan`). */
	const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
		Object.entries(where).every(([column, value]) => (value && typeof value === 'object' && '_type' in value ? true : row[column] === value));
	const repositories = {
		ChatMessage: { findOne: jest.fn(async () => (message ? { ...message } : null)) },
		ChatWebhook: { findOne: jest.fn(async () => (webhook ? { ...webhook } : null)), increment: jest.fn(async () => ({ affected: 1 })) },
		ChatConversation: { findOne: jest.fn(async () => ({ id: 'c1', archivedAt: null })) },
		ChatWebhookInteraction: {
			create: jest.fn((row: Record<string, unknown>) => row),
			save: jest.fn(async (row: Record<string, unknown>) => {
				if (options.saveGate) await options.saveGate;
				// The unique (tenant, message, clicker, key) index: a NULL key never collides.
				if (row['idempotencyKey'] != null && interactions.some((other) => KEY_COLUMNS.every((column) => other[column] === row[column]))) {
					throw (options.uniqueViolation ?? UNIQUE_VIOLATIONS[0][1])();
				}
				const saved = { ...row, id: `i-${interactions.length + 1}`, createdAt: new Date('2026-11-11T10:00:00Z'), updatedAt: new Date() };
				interactions.push(saved);
				return saved;
			}),
			update: jest.fn(async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
				interactionUpdates.push({ where, patch });
				// The rows are written as the service writes them, so a later read sees the click as it is now.
				for (const row of interactions) if (matches(row, where)) Object.assign(row, patch, { updatedAt: new Date() });
				return { affected: 1 };
			}),
			findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
				const row = interactions.find((candidate) => matches(candidate, where));
				return row ? { ...row } : null;
			})
		}
	};
	const dataSource = {
		getRepository: (entity: string | { name?: string }) => (repositories as Record<string, unknown>)[(typeof entity === 'string' ? entity : entity?.name) as string]
	} as unknown as DataSource;
	const access = {
		requireMember: jest.fn(async () => {
			if (options.notMember) throw new NotFoundException('The requested record was not found');
			return { conversation: { id: 'c1', name: 'alerts', archivedAt: null }, member: options.noMembership ? null : { id: 'mb1' } };
		})
	} as unknown as ChatAccessService;
	const messages = { withRelations: jest.fn(async (_caller: unknown, rows: unknown[]) => rows) } as unknown as ChatMessageService;
	// The writer's claim of replyAppliedAt: one reply per interaction id.
	const writer = {
		replaceOnce: jest.fn(async (_messageId: string, interactionId: string, content: { body: string }) => {
			if (applied.has(interactionId)) return null;
			applied.add(interactionId);
			const editedAt = new Date();
			// The claim the real writer makes in its transaction.
			for (const row of interactions) if (row['id'] === interactionId) row['replyAppliedAt'] = editedAt;
			return { message: { ...message, body: content.body, editedAt }, events: [{ name: 'chat_message.updated', data: {} }] };
		})
	} as unknown as ChatAppMessageWriter & { replaceOnce: jest.Mock };
	const queue = [...(options.attempts ?? [{ outcome: 'delivered', status: 200, body: Buffer.from(''), contentType: 'application/json' }])];
	const sent: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
	const transport = {
		post: jest.fn(async (url: string, headers: Record<string, string>, body: string) => {
			sent.push({ url, headers, body });
			return queue.shift() ?? { outcome: 'retry', status: 503, error: 'http_503' };
		})
	} as unknown as ChatInteractionTransport;
	const service = new ChatInteractionService(dataSource, access, messages, writer, transport);
	service.retryDelaysMs = [1, 1, 1];
	return { service, sent, writer, repositories, interactionUpdates, interactions, access: access as unknown as { requireMember: jest.Mock }, messages: messages as unknown as { withRelations: jest.Mock } };
}

/**
 * Waits until the background retries have run: each is a 1 ms timer whose attempt settles in microtasks (every double
 * answers at once), so no timer left means no retry left. A fixed pause was too short on a loaded machine.
 */
async function retriesDone(service: ChatInteractionService): Promise<void> {
	const timers = (service as unknown as { timers: Set<unknown> }).timers;
	const deadline = Date.now() + 5_000;
	do {
		await new Promise((resolve) => setTimeout(resolve, 5));
	} while (timers.size > 0 && Date.now() < deadline);
}

describe('ChatInteractionService', () => {
	const env = { ...process.env };
	beforeEach(() => {
		process.env['GAUZY_CHAT_WEBHOOKS_ENABLED'] = 'true';
		mockCurrentUser.mockReturnValue({ id: 'u1', firstName: 'Ana', lastName: 'Lee', email: 'ana@example.com' });
	});
	afterAll(() => {
		process.env = env;
	});

	it('posts a signed callback with the actor, the message, the stored action value and the interaction id', async () => {
		const { service, sent } = setup();
		const result = await service.interact(member, 'm1', { actionId: 'ack' });
		expect(result.interaction).toEqual(expect.objectContaining({ interactionId: 'i-1', status: ChatInteractionStatusEnum.DELIVERED, attempts: 1, replyApplied: false }));
		expect(sent).toHaveLength(1);
		const [{ url, headers, body }] = sent;
		expect(url).toBe('https://hooks.example.com/interact');
		expect(verifyWebhookSignature('signing-secret', body, headers[WebhookHeader.SIGNATURE])).toBe(true);
		expect(headers['Idempotency-Key']).toBe('i-1');
		const payload = JSON.parse(body);
		expect(payload).toEqual({
			type: 'block_actions',
			interactionId: 'i-1',
			actionAt: '2026-11-11T10:00:00.000Z',
			webhook: { id: 'w1', name: 'Monitor' },
			conversation: { id: 'c1', name: 'alerts' },
			message: { id: 'm1', createdAt: '2026-11-11T09:00:00.000Z' },
			actor: { employeeId: 'e1', name: 'Ana Lee' },
			action: { actionId: 'ack', blockId: 'alert-7', value: 'alert-7', text: 'Acknowledge' }
		});
		// No employee data beyond the name and the id.
		expect(body).not.toContain('ana@example.com');
		expect(body).not.toContain('u1');
	});

	it('answers 404 to someone who may not read the message, and for anything that is not an app button', async () => {
		await expect(setup({ notMember: true }).service.interact(member, 'm1', { actionId: 'ack' })).rejects.toThrow(NotFoundException);
		await expect(setup({ message: null }).service.interact(member, 'm1', { actionId: 'ack' })).rejects.toThrow(NotFoundException);
		await expect(setup({ message: { kind: ChatMessageKindEnum.MESSAGE } }).service.interact(member, 'm1', { actionId: 'ack' })).rejects.toThrow(NotFoundException);
		await expect(setup().service.interact(member, 'm1', { actionId: 'nope' })).rejects.toThrow(NotFoundException);
		await expect(setup().service.interact(member, 'm1', { actionId: 'ack', blockId: 'other' })).rejects.toThrow(NotFoundException);
		process.env['GAUZY_CHAT_WEBHOOKS_ENABLED'] = 'false';
		await expect(setup().service.interact(member, 'm1', { actionId: 'ack' })).rejects.toThrow(NotFoundException);
	});

	it('refuses a link button, and a webhook that no longer takes interactions', async () => {
		await expect(setup().service.interact(member, 'm1', { actionId: 'open' })).rejects.toThrow(BadRequestException);
		await expect(setup({ webhook: { revokedAt: new Date() } }).service.interact(member, 'm1', { actionId: 'ack' })).rejects.toThrow(ConflictException);
		await expect(setup({ webhook: { interactionUrl: null } }).service.interact(member, 'm1', { actionId: 'ack' })).rejects.toThrow(ConflictException);
		await expect(setup({ webhook: { signingSecret: 'cw1:k:tampered:x:y' } }).service.interact(member, 'm1', { actionId: 'ack' })).rejects.toThrow(ConflictException);
	});

	it('applies the reply in place', async () => {
		const reply = Buffer.from(JSON.stringify({ text: 'Acknowledged by Ana', blocks: [{ type: 'context', elements: [{ type: 'plain_text', text: 'by Ana' }] }] }));
		const { service, writer } = setup({ attempts: [{ outcome: 'delivered', status: 200, body: reply, contentType: 'application/json' }] });
		const result = await service.interact(member, 'm1', { actionId: 'ack' });
		expect(writer.replaceOnce).toHaveBeenCalledTimes(1);
		expect(writer.replaceOnce.mock.calls[0][2]).toEqual({ body: 'Acknowledged by Ana', blocks: [{ type: ChatAppBlockTypeEnum.CONTEXT, elements: ['by Ana'] }], nonce: null });
		expect(result.interaction.replyApplied).toBe(true);
		expect(result.message?.body).toBe('Acknowledged by Ana');
		expect(result.events).toEqual([{ name: 'chat_message.updated', data: {} }]);
	});

	it('retries three times, each signed afresh with the same interaction id, then fails', async () => {
		const failing: ChatInteractionAttempt = { outcome: 'retry', status: 503, error: 'http_503' };
		const { service, sent, repositories, interactionUpdates } = setup({ attempts: [failing, failing, failing, failing] });
		const result = await service.interact(member, 'm1', { actionId: 'ack' });
		expect(result.interaction.status).toBe(ChatInteractionStatusEnum.RETRYING);
		await retriesDone(service);
		expect(sent).toHaveLength(4);
		expect(new Set(sent.map((attempt) => attempt.headers['Idempotency-Key']))).toEqual(new Set(['i-1']));
		expect(sent.map((attempt) => attempt.headers[WebhookHeader.ATTEMPT])).toEqual(['1', '2', '3', '4']);
		expect(new Set(sent.map((attempt) => JSON.parse(attempt.body).interactionId))).toEqual(new Set(['i-1']));
		expect(interactionUpdates[interactionUpdates.length - 1].patch).toEqual(expect.objectContaining({ status: ChatInteractionStatusEnum.FAILED, attempts: 4 }));
		expect(repositories.ChatWebhook.increment).toHaveBeenCalledWith({ id: 'w1' }, 'callbackFailureCount', 1);
	});

	it('does not retry a refused target', async () => {
		const { service, sent } = setup({ attempts: [{ outcome: 'refused', status: 0, error: 'target_refused' }] });
		const result = await service.interact(member, 'm1', { actionId: 'ack' });
		expect(result.interaction).toEqual(expect.objectContaining({ status: ChatInteractionStatusEnum.FAILED, error: 'target_refused' }));
		await retriesDone(service);
		expect(sent).toHaveLength(1);
	});

	it('applies a reply at most once per interaction, and once for each separate click', async () => {
		const reply = Buffer.from(JSON.stringify({ text: 'Done' }));
		const delivered: ChatInteractionAttempt = { outcome: 'delivered', status: 200, body: reply, contentType: 'application/json' };
		// One interaction whose earlier answer was lost: the retry is answered again, and the writer's claim decides.
		const retried = setup({ attempts: [{ outcome: 'retry', status: 0, error: 'timeout' }, delivered] });
		await retried.service.interact(member, 'm1', { actionId: 'ack' });
		await retriesDone(retried.service);
		expect(retried.writer.replaceOnce).toHaveBeenCalledTimes(1);
		expect(retried.writer.replaceOnce.mock.calls[0][1]).toBe('i-1');
		// Two clicks are two interactions, each with its own id, and each reply applies.
		const clicks = setup({ attempts: [delivered, delivered] });
		const first = await clicks.service.interact(member, 'm1', { actionId: 'ack' });
		const second = await clicks.service.interact(member, 'm1', { actionId: 'ack' });
		expect(first.interaction.interactionId).not.toBe(second.interaction.interactionId);
		expect(clicks.writer.replaceOnce.mock.calls.map((call) => call[1])).toEqual([first.interaction.interactionId, second.interaction.interactionId]);
		expect(second.interaction.replyApplied).toBe(true);
		// The same interaction answered twice (the double's claim already taken): the message is left alone.
		const again = await clicks.service['applyReply']({ interaction: { id: first.interaction.interactionId }, message: { id: 'm1' }, webhook: { canBroadcast: false } } as never, reply);
		expect(again).toEqual([]);
	});

	it('keeps a click delivered when its reply cannot be written', async () => {
		const reply = Buffer.from(JSON.stringify({ text: 'Done' }));
		const { service, writer, interactionUpdates } = setup({ attempts: [{ outcome: 'delivered', status: 200, body: reply, contentType: 'application/json' }] });
		writer.replaceOnce.mockRejectedValueOnce(new Error('deadlock'));
		const result = await service.interact(member, 'm1', { actionId: 'ack' });
		expect(result.interaction).toEqual(expect.objectContaining({ status: ChatInteractionStatusEnum.DELIVERED, error: 'reply_failed', replyApplied: false }));
		expect(interactionUpdates[interactionUpdates.length - 1].patch).toEqual({ lastError: 'reply_failed' });
	});

	it('answers 404 to a chat manager who reads the channel without being in it', async () => {
		await expect(setup({ noMembership: true }).service.interact(member, 'm1', { actionId: 'ack' })).rejects.toThrow(NotFoundException);
	});

	it('marks interactions a stopped process left under way as failed, only the stale ones', async () => {
		const { service, repositories } = setup();
		await service.onModuleInit();
		const [where, patch] = repositories.ChatWebhookInteraction.update.mock.calls[0] as [Record<string, { _type?: string }>, Record<string, unknown>];
		expect(patch).toEqual({ status: ChatInteractionStatusEnum.FAILED, lastError: 'process_restarted' });
		expect(where['status']?._type).toBe('in');
		expect(where['updatedAt']?._type).toBe('lessThan');
	});

	it('answers the state of a click to the person who clicked only', async () => {
		const { service, repositories } = setup();
		await service.interact(member, 'm1', { actionId: 'ack' });
		const state = await service.state(member, 'i-1');
		expect(state.interactionId).toBe('i-1');
		expect(repositories.ChatWebhookInteraction.findOne).toHaveBeenCalledWith({ where: { id: 'i-1', tenantId: 'ten', actorUserId: 'u1' } });
	});

	it('answers a click its process left under way after the start-up sweep as failed, and a live one as it is', async () => {
		const { service, repositories } = setup();
		const row = { id: 'i-9', messageId: 'm1', conversationId: 'c1', actionId: 'ack', status: ChatInteractionStatusEnum.RETRYING, attempts: 2 };
		// Untouched for longer than twice the whole retry schedule: its retries are gone.
		repositories.ChatWebhookInteraction.findOne.mockResolvedValueOnce({ ...row, updatedAt: new Date(Date.now() - 10 * 60_000) });
		const stale = await service.state(member, 'i-9');
		expect(stale).toEqual(expect.objectContaining({ status: ChatInteractionStatusEnum.FAILED, error: 'process_restarted' }));
		const [where, patch] = repositories.ChatWebhookInteraction.update.mock.calls[0] as [Record<string, { _type?: string } | string>, Record<string, unknown>];
		expect(where['id']).toBe('i-9');
		// Only while it is still under way: a retry that settled meanwhile is not overwritten.
		expect((where['status'] as { _type?: string })._type).toBe('in');
		expect(patch).toEqual({ status: ChatInteractionStatusEnum.FAILED, lastError: 'process_restarted' });
		// A retry under way (touched seconds ago) is left alone.
		repositories.ChatWebhookInteraction.findOne.mockResolvedValueOnce({ ...row, updatedAt: new Date(Date.now() - 5_000) });
		const live = await service.state(member, 'i-9');
		expect(live.status).toBe(ChatInteractionStatusEnum.RETRYING);
		expect(repositories.ChatWebhookInteraction.update).toHaveBeenCalledTimes(1);
	});

	describe('Idempotency-Key', () => {
		/** An answered callback, for a test that clicks more than once (an unanswered one would retry in the background). */
		const delivered = (): ChatInteractionAttempt => ({ outcome: 'delivered', status: 200, body: Buffer.from(''), contentType: 'application/json' });

		it('makes the same key sent twice one interaction and one callback, answered the second time as it is now', async () => {
			const { service, sent, repositories, interactions } = setup();
			const first = await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			const again = await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			expect(sent).toHaveLength(1);
			expect(repositories.ChatWebhookInteraction.save).toHaveBeenCalledTimes(1);
			expect(interactions).toHaveLength(1);
			expect(interactions[0]).toEqual(expect.objectContaining({ idempotencyKey: 'click-1', tenantId: 'ten', messageId: 'm1', actorUserId: 'u1' }));
			expect(first.replayed).toBeUndefined();
			expect(again).toEqual({ interaction: first.interaction, events: [], replayed: true });
			// The repeat is looked up by the unique index's columns: this tenant, this message, this clicker, this key.
			expect(repositories.ChatWebhookInteraction.findOne).toHaveBeenCalledWith({ where: { tenantId: 'ten', messageId: 'm1', actorUserId: 'u1', idempotencyKey: 'click-1' } });
		});

		it('answers a repeat with the click as it is now: retried meanwhile, then delivered with a reply', async () => {
			const reply = Buffer.from(JSON.stringify({ text: 'Acknowledged by Ana' }));
			const { service, sent, writer, messages, repositories } = setup({ attempts: [{ outcome: 'retry', status: 503, error: 'http_503' }, { outcome: 'delivered', status: 200, body: reply, contentType: 'application/json' }] });
			const first = await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			expect(first.interaction.status).toBe(ChatInteractionStatusEnum.RETRYING);
			const underWay = await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			expect(underWay.interaction).toEqual(expect.objectContaining({ interactionId: first.interaction.interactionId, status: ChatInteractionStatusEnum.RETRYING, replyApplied: false }));
			expect(underWay.message).toBeUndefined();
			await retriesDone(service);
			// The request reads the message before the click; the reply lands in between (its copy still has the buttons).
			const before = { id: 'm1', tenantId: 'ten', organizationId: 'org', conversationId: 'c1', kind: ChatMessageKindEnum.APP, webhookId: 'w1', body: 'CPU high', blocks: JSON.stringify(BLOCKS) };
			repositories.ChatMessage.findOne.mockResolvedValueOnce(before as never).mockResolvedValueOnce({ ...before, body: 'Acknowledged by Ana', blocks: null } as never);
			const settled = await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			expect(settled.interaction).toEqual(expect.objectContaining({ interactionId: first.interaction.interactionId, status: ChatInteractionStatusEnum.DELIVERED, replyApplied: true, attempts: 2 }));
			// The message as the reply left it (read again once the reply is seen applied), and no events: the first answer
			// and the stream carried them.
			expect(settled.message).toEqual(expect.objectContaining({ id: 'm1', body: 'Acknowledged by Ana', blocks: null }));
			expect(messages.withRelations).toHaveBeenCalledTimes(1);
			expect(settled.events).toEqual([]);
			// The app was called by the first click's own retry only, and its reply applied once.
			expect(sent).toHaveLength(2);
			expect(new Set(sent.map((attempt) => attempt.headers['Idempotency-Key']))).toEqual(new Set([first.interaction.interactionId]));
			expect(writer.replaceOnce).toHaveBeenCalledTimes(1);
		});

		it('answers a repeat after the reply replaced the buttons, the channel was archived or the app revoked', async () => {
			const { service, sent, repositories, access } = setup();
			const first = await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			repositories.ChatMessage.findOne.mockResolvedValueOnce({ id: 'm1', tenantId: 'ten', conversationId: 'c1', kind: ChatMessageKindEnum.APP, webhookId: 'w1', body: 'Acknowledged', blocks: '[]' } as never);
			access.requireMember.mockResolvedValueOnce({ conversation: { id: 'c1', name: 'alerts', archivedAt: new Date() }, member: { id: 'mb1' } });
			repositories.ChatWebhook.findOne.mockResolvedValueOnce({ id: 'w1', revokedAt: new Date() } as never);
			const again = await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			expect(again.interaction.interactionId).toBe(first.interaction.interactionId);
			expect(again.replayed).toBe(true);
			expect(sent).toHaveLength(1);
			// The webhook is not even read for a repeat: nothing is sent to it.
			expect(repositories.ChatWebhook.findOne).toHaveBeenCalledTimes(1);
		});

		it('still checks who asks: a repeat by someone who may not read the message is a 404, and another person’s key is theirs', async () => {
			const { service, sent, interactions, access } = setup({ attempts: [delivered(), delivered()] });
			await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			access.requireMember.mockRejectedValueOnce(new NotFoundException('The requested record was not found'));
			await expect(service.interact(member, 'm1', { actionId: 'ack' }, 'click-1')).rejects.toThrow(NotFoundException);
			// Another member who happens to send the same key clicks for themselves.
			const other = await service.interact({ ...member, userId: 'u2', employeeId: 'e2' }, 'm1', { actionId: 'ack' }, 'click-1');
			expect(other.replayed).toBeUndefined();
			expect(interactions).toHaveLength(2);
			expect(sent).toHaveLength(2);
		});

		it('refuses the same key for another button (409), and sends nothing', async () => {
			const { service, sent, interactions } = setup();
			await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			const refusal = await service.interact(member, 'm1', { actionId: 'snooze' }, 'click-1').catch((error: unknown) => error);
			expect(refusal).toBeInstanceOf(ApiException);
			expect((refusal as ApiException).getStatus()).toBe(409);
			expect((refusal as ApiException).code).toBe(ApiErrorCode.IDEMPOTENCY_KEY_REUSED);
			await expect(service.interact(member, 'm1', { actionId: 'ack', blockId: 'other-block' }, 'click-1')).rejects.toThrow(ApiException);
			// A button the message no longer has is still another button: refused, not a 404.
			await expect(service.interact(member, 'm1', { actionId: 'gone' }, 'click-1')).rejects.toThrow(ApiException);
			expect(sent).toHaveLength(1);
			expect(interactions).toHaveLength(1);
		});

		it('takes a repeat that names the block id the first request left out (or leaves out the one it named) as the same button', async () => {
			const { service, sent } = setup({ attempts: [delivered(), delivered()] });
			const first = await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			const named = await service.interact(member, 'm1', { actionId: 'ack', blockId: 'alert-7' }, 'click-1');
			expect(named.interaction.interactionId).toBe(first.interaction.interactionId);
			const second = await service.interact(member, 'm1', { actionId: 'ack', blockId: 'alert-7' }, 'click-2');
			const unnamed = await service.interact(member, 'm1', { actionId: 'ack' }, 'click-2');
			expect(unnamed.interaction.interactionId).toBe(second.interaction.interactionId);
			expect(sent).toHaveLength(2);
		});

		it.each(UNIQUE_VIOLATIONS)('makes two concurrent requests with one key one interaction and one callback (%s)', async (_driver, uniqueViolation) => {
			// Both requests look the key up before either writes (the gate opens once both have): the unique index is
			// what refuses the second row, and the loser answers with the winner's click.
			const bothLooked = deferred();
			const { service, sent, interactions, repositories } = setup({ uniqueViolation, saveGate: bothLooked.promise });
			openWhenBothLooked(repositories.ChatWebhookInteraction.findOne, bothLooked);
			const [one, two] = await Promise.all([
				service.interact(member, 'm1', { actionId: 'ack' }, 'click-1'),
				service.interact(member, 'm1', { actionId: 'ack' }, 'click-1')
			]);
			expect(repositories.ChatWebhookInteraction.save).toHaveBeenCalledTimes(2);
			expect(interactions).toHaveLength(1);
			expect(sent).toHaveLength(1);
			expect(one.interaction.interactionId).toBe(two.interaction.interactionId);
			expect([one.replayed, two.replayed].filter(Boolean)).toEqual([true]);
		});

		it('refuses the loser of a race that used the key for another button', async () => {
			const bothLooked = deferred();
			const { service, sent, repositories } = setup({ saveGate: bothLooked.promise });
			openWhenBothLooked(repositories.ChatWebhookInteraction.findOne, bothLooked);
			const results = await Promise.allSettled([service.interact(member, 'm1', { actionId: 'ack' }, 'click-1'), service.interact(member, 'm1', { actionId: 'snooze' }, 'click-1')]);
			expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
			expect(((results[1] as PromiseRejectedResult).reason as ApiException).code).toBe(ApiErrorCode.IDEMPOTENCY_KEY_REUSED);
			expect(sent).toHaveLength(1);
		});

		it('raises a failed write that is not the key’s, and a refusal whose winner cannot be read', async () => {
			const failing = setup();
			failing.repositories.ChatWebhookInteraction.save.mockRejectedValueOnce(new Error('disk full'));
			await expect(failing.service.interact(member, 'm1', { actionId: 'ack' }, 'click-1')).rejects.toThrow('disk full');
			// A unique violation with no key at all is not a repeat.
			const keyless = setup();
			keyless.repositories.ChatWebhookInteraction.save.mockRejectedValueOnce(UNIQUE_VIOLATIONS[0][1]());
			await expect(keyless.service.interact(member, 'm1', { actionId: 'ack' })).rejects.toThrow(/duplicate key/);
			// The index refused the row, yet no row of the key can be read (another index): raised as it is.
			const unreadable = setup();
			unreadable.repositories.ChatWebhookInteraction.save.mockRejectedValueOnce(UNIQUE_VIOLATIONS[2][1]());
			await expect(unreadable.service.interact(member, 'm1', { actionId: 'ack' }, 'click-1')).rejects.toThrow(/UNIQUE constraint failed/);
			expect(failing.sent.length + keyless.sent.length + unreadable.sent.length).toBe(0);
		});

		it('keeps one interaction per request for a client that sends no key', async () => {
			const { service, sent, interactions } = setup({ attempts: [delivered(), delivered()] });
			const first = await service.interact(member, 'm1', { actionId: 'ack' });
			const second = await service.interact(member, 'm1', { actionId: 'ack' }, '   ');
			expect(first.interaction.interactionId).not.toBe(second.interaction.interactionId);
			expect(interactions.map((row) => row['idempotencyKey'])).toEqual([null, null]);
			expect(sent).toHaveLength(2);
		});

		it('answers a repeat of a click left under way past its whole retry schedule as failed', async () => {
			const { service, interactions, interactionUpdates } = setup();
			await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			Object.assign(interactions[0], { status: ChatInteractionStatusEnum.RETRYING, updatedAt: new Date(Date.now() - 10 * 60_000) });
			const again = await service.interact(member, 'm1', { actionId: 'ack' }, 'click-1');
			expect(again.interaction).toEqual(expect.objectContaining({ status: ChatInteractionStatusEnum.FAILED, error: 'process_restarted' }));
			expect(interactionUpdates[interactionUpdates.length - 1].patch).toEqual({ status: ChatInteractionStatusEnum.FAILED, lastError: 'process_restarted' });
		});

		it('reads the key as the receive route does: trimmed, at most 64 printable characters, a blank one as none', async () => {
			expect(interactionKeyOf(undefined)).toBeNull();
			expect(interactionKeyOf('  ')).toBeNull();
			expect(interactionKeyOf('  click-1 ')).toBe('click-1');
			expect(interactionKeyOf(['first', 'second'])).toBe('first');
			expect(interactionKeyOf('k'.repeat(64))).toBe('k'.repeat(64));
			for (const bad of ['k'.repeat(65), 'click\u0000one', 'tab\there']) {
				const refusal = (() => {
					try {
						return interactionKeyOf(bad);
					} catch (error) {
						return error;
					}
				})();
				expect(refusal).toBeInstanceOf(ApiException);
				expect((refusal as ApiException).getStatus()).toBe(400);
			}
			// Refused before anything is read or sent.
			const { service, sent, repositories } = setup();
			await expect(service.interact(member, 'm1', { actionId: 'ack' }, 'k'.repeat(65))).rejects.toThrow(ApiException);
			expect(repositories.ChatMessage.findOne).not.toHaveBeenCalled();
			expect(sent).toHaveLength(0);
		});
	});
});
