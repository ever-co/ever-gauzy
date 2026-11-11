/**
 * `ChatInteractionService`: a member's click on an app-message button — who may click (404 otherwise), what is sent
 * (the stored button value, the actor's id and name only, signed, the interaction id as `Idempotency-Key`), the
 * retries (three, signed afresh, the same interaction id), and the reply applied at most once.
 *
 * `@gauzy/core` is doubled at the module boundary; its webhook signer and verifier are the real ones.
 */
const mockCurrentUser = jest.fn();
jest.mock('@gauzy/core', () => {
	const signature = jest.requireActual('../../../../../core/src/lib/webhook/webhook-signature');
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		signWebhookPayload: signature.signWebhookPayload,
		verifyWebhookSignature: signature.verifyWebhookSignature,
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentUser: () => mockCurrentUser(), hasPermission: () => false }
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {
		return undefined;
	}) });
});

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatAppBlockTypeEnum, ChatInteractionStatusEnum, ChatMessageKindEnum, WebhookHeader } from '@gauzy/contracts';
import { verifyWebhookSignature } from '@gauzy/core';
import { ChatAccessService, IChatCaller } from '../services/chat-access.service';
import { ChatMessageService } from '../services/chat-message.service';
import { ChatAppMessageWriter } from './chat-app-message.writer';
import { ChatInteractionAttempt, ChatInteractionTransport } from './chat-interaction-transport';
import { ChatInteractionService } from './chat-interaction.service';
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
			{ actionId: 'open', text: 'Open', value: null, url: 'https://monitor.example.com/7', style: null }
		]
	}
];

interface ISetup {
	message?: Record<string, unknown> | null;
	webhook?: Record<string, unknown> | null;
	attempts?: ChatInteractionAttempt[];
	notMember?: boolean;
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
	let replyApplied = false;
	const repositories = {
		ChatMessage: { findOne: jest.fn(async () => (message ? { ...message } : null)) },
		ChatWebhook: { findOne: jest.fn(async () => (webhook ? { ...webhook } : null)), increment: jest.fn(async () => ({ affected: 1 })) },
		ChatConversation: { findOne: jest.fn(async () => ({ id: 'c1', archivedAt: null })) },
		ChatWebhookInteraction: {
			create: jest.fn((row: Record<string, unknown>) => row),
			save: jest.fn(async (row: Record<string, unknown>) => {
				const saved = { ...row, id: 'i-1', createdAt: new Date('2026-11-11T10:00:00Z') };
				interactions.push(saved);
				return saved;
			}),
			update: jest.fn(async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
				interactionUpdates.push({ where, patch });
				return { affected: 1 };
			}),
			findOne: jest.fn(async () => interactions[0] ?? null)
		}
	};
	const dataSource = {
		getRepository: (entity: string | { name?: string }) => (repositories as Record<string, unknown>)[(typeof entity === 'string' ? entity : entity?.name) as string]
	} as unknown as DataSource;
	const access = {
		requireMember: jest.fn(async () => {
			if (options.notMember) throw new NotFoundException('The requested record was not found');
			return { conversation: { id: 'c1', name: 'alerts', archivedAt: null }, member: { id: 'mb1' } };
		})
	} as unknown as ChatAccessService;
	const messages = { withRelations: jest.fn(async (_caller: unknown, rows: unknown[]) => rows) } as unknown as ChatMessageService;
	// The writer's claim of replyAppliedAt: only the first reply of this setup's message is applied.
	const writer = {
		replaceOnce: jest.fn(async (_messageId: string, _interactionId: string, content: { body: string }) => {
			if (replyApplied) return null;
			replyApplied = true;
			return { message: { ...message, body: content.body, editedAt: new Date() }, events: [{ name: 'chat_message.updated', data: {} }] };
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
	return { service, sent, writer, repositories, interactionUpdates };
}

/** Waits until the background retries have run (each is a 1 ms timer). */
const retriesDone = () => new Promise((resolve) => setTimeout(resolve, 60));

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
		await retriesDone();
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
		await retriesDone();
		expect(sent).toHaveLength(1);
	});

	it('applies a reply at most once, even when a retry is answered again after a lost answer', async () => {
		const reply = Buffer.from(JSON.stringify({ text: 'Done' }));
		const { service, writer } = setup({
			attempts: [
				{ outcome: 'retry', status: 0, error: 'timeout' },
				{ outcome: 'delivered', status: 200, body: reply, contentType: 'application/json' }
			]
		});
		await service.interact(member, 'm1', { actionId: 'ack' });
		await retriesDone();
		expect(writer.replaceOnce).toHaveBeenCalledTimes(1);
		// The interaction row already has its reply (an earlier attempt's answer arrived after all): the compare-and-set
		// on replyAppliedAt misses, and the message is left alone.
		expect(writer.replaceOnce).toHaveBeenCalledTimes(1);
		const claims = setup({ attempts: [{ outcome: 'delivered', status: 200, body: reply, contentType: 'application/json' }, { outcome: 'delivered', status: 200, body: reply, contentType: 'application/json' }] });
		await claims.service.interact(member, 'm1', { actionId: 'ack' });
		const second = await claims.service.interact(member, 'm1', { actionId: 'ack' });
		expect(claims.writer.replaceOnce).toHaveBeenCalledTimes(2);
		expect(second.interaction.replyApplied).toBe(false);
		expect(second.message).toBeUndefined();
	});

	it('answers the state of a click to the person who clicked only', async () => {
		const { service, repositories } = setup();
		await service.interact(member, 'm1', { actionId: 'ack' });
		const state = await service.state(member, 'i-1');
		expect(state.interactionId).toBe('i-1');
		expect(repositories.ChatWebhookInteraction.findOne).toHaveBeenCalledWith({ where: { id: 'i-1', tenantId: 'ten', actorUserId: 'u1' } });
	});
});
