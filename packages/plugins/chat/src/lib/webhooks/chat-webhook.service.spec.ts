// cspell:ignore gzcws
/**
 * `ChatWebhookService`: the receive side of the public route (what a sender is answered) and the management rules
 * (channels only, at most ten, managers only, the secrets shown once, the activity log), over repository doubles.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application), as in the other specs.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentUser: () => null, hasPermission: () => false }
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {
		return undefined;
	}) });
});
// The deployment's configured feature state (the FEATURE_CHAT environment variable), as a spec sets it.
const mockToggles: Record<string, boolean> = { FEATURE_CHAT: true };
jest.mock('@gauzy/config', () => ({ gauzyToggleFeatures: mockToggles }));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ActionTypeEnum, BaseEntityEnum, ChatConversationKindEnum, FeatureEnum } from '@gauzy/contracts';
import { ActivityLogService } from '@gauzy/core';
import { ChatAccessService, IChatCaller } from '../services/chat-access.service';
import { ChatAppMessageWriter } from './chat-app-message.writer';
import { ChatWebhookRateLimiter } from './chat-webhook-rate-limiter';
import { ChatWebhookService } from './chat-webhook.service';
import { newWebhookToken, webhookTokenHash } from './chat-webhook-token';

const KEY = Buffer.alloc(32, 3).toString('base64');
const manager: IChatCaller = { tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: false };

function setup(options: { webhook?: Record<string, unknown> | null; conversation?: Record<string, unknown> | null; toggles?: Array<Record<string, unknown>>; active?: number } = {}) {
	const token = newWebhookToken();
	const webhook =
		options.webhook === null
			? null
			: { id: 'w1', tenantId: 'ten', organizationId: 'org', conversationId: 'c1', name: 'Deploys', tokenHash: webhookTokenHash(token), tokenHint: token.slice(-4), canBroadcast: false, revokedAt: null, ...options.webhook };
	const conversation =
		options.conversation === null ? null : { id: 'c1', tenantId: 'ten', organizationId: 'org', kind: ChatConversationKindEnum.CHANNEL, name: 'deploys', archivedAt: null, ...options.conversation };
	const repositories = {
		ChatWebhook: {
			findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => (webhook && (where['tokenHash'] === webhook.tokenHash || where['id'] === webhook.id) ? { ...webhook } : null)),
			find: jest.fn(async () => (webhook ? [{ ...webhook }] : [])),
			count: jest.fn(async () => options.active ?? 0),
			create: jest.fn((row: Record<string, unknown>) => row),
			save: jest.fn(async (row: Record<string, unknown>) => ({ ...row, createdAt: new Date('2026-11-11T10:00:00Z') })),
			update: jest.fn(async () => ({ affected: 1 })),
			increment: jest.fn(async () => ({ affected: 1 }))
		},
		ChatConversation: { findOne: jest.fn(async () => (conversation ? { ...conversation } : null)) },
		Feature: { findOne: jest.fn(async () => ({ id: 'f-chat' })) },
		FeatureOrganization: { find: jest.fn(async () => options.toggles ?? []) }
	};
	const getRepository = (entity: string | { name?: string }) => (repositories as Record<string, unknown>)[(typeof entity === 'string' ? entity : entity?.name) as string];
	const dataSource = {
		options: { type: 'postgres' },
		getRepository,
		transaction: jest.fn(async (work: (manager: { getRepository: typeof getRepository }) => Promise<unknown>) => work({ getRepository }))
	} as unknown as DataSource;
	const access = {
		requireManager: jest.fn(async () => ({ conversation: { ...conversation }, member: { role: 'manager' } }))
	} as unknown as ChatAccessService & { requireManager: jest.Mock };
	const writer = { post: jest.fn(async () => ({ message: { id: 'm1' }, duplicate: false, events: [] })) } as unknown as ChatAppMessageWriter & { post: jest.Mock };
	const limiter = { take: jest.fn(async () => ({ allowed: true })) } as unknown as ChatWebhookRateLimiter & { take: jest.Mock };
	const activityLog = { logActivity: jest.fn() } as unknown as ActivityLogService & { logActivity: jest.Mock };
	const service = new ChatWebhookService(dataSource, access, writer, limiter, activityLog);
	return { service, token, repositories, access, writer, limiter, activityLog };
}

/** Lets the counters (fired off the answer's path) settle. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('ChatWebhookService', () => {
	const env = { ...process.env };
	beforeEach(() => {
		process.env['GAUZY_CHAT_WEBHOOKS_ENABLED'] = 'true';
		process.env['ENCRYPTION_KEY'] = KEY;
		process.env['API_BASE_URL'] = 'https://api.example.com/';
	});
	afterAll(() => {
		process.env = env;
	});

	describe('receive', () => {
		it('posts a text payload and answers 200 ok, counting the post', async () => {
			const { service, token, writer, repositories } = setup();
			const receipt = await service.receive(token, { text: 'Build 412 passed' }, 30);
			expect(receipt).toEqual({ status: 200, body: 'ok' });
			expect(writer.post).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1' }), expect.objectContaining({ id: 'c1' }), { body: 'Build 412 passed', blocks: [], nonce: null });
			await settle();
			expect(repositories.ChatWebhook.increment).toHaveBeenCalledWith({ id: 'w1' }, 'acceptedCount', 1);
			expect(repositories.ChatWebhook.update).toHaveBeenCalledWith({ id: 'w1' }, { lastUsedAt: expect.any(Date) });
		});

		it('answers 404 for a revoked, unknown or malformed URL, with webhooks off, and posts nothing', async () => {
			const revoked = setup({ webhook: { revokedAt: new Date() } });
			expect(await revoked.service.receive(revoked.token, { text: 'x' }, 10)).toEqual({ status: 404, body: 'no_webhook' });
			const unknown = setup({ webhook: null });
			expect(await unknown.service.receive(unknown.token, { text: 'x' }, 10)).toEqual({ status: 404, body: 'no_webhook' });
			const malformed = setup();
			expect(await malformed.service.receive('not-a-token', { text: 'x' }, 10)).toEqual({ status: 404, body: 'no_webhook' });
			expect(malformed.repositories.ChatWebhook.findOne).not.toHaveBeenCalled();
			process.env['GAUZY_CHAT_WEBHOOKS_ENABLED'] = 'false';
			const off = setup();
			expect(await off.service.receive(off.token, { text: 'x' }, 10)).toEqual({ status: 404, body: 'no_webhook' });
			for (const run of [revoked, unknown, malformed, off]) expect(run.writer.post).not.toHaveBeenCalled();
		});

		it('never posts to a direct or group conversation, nor for a tenant that turned chat off', async () => {
			const direct = setup({ conversation: { kind: ChatConversationKindEnum.DIRECT } });
			expect(await direct.service.receive(direct.token, { text: 'x' }, 10)).toEqual({ status: 404, body: 'no_webhook' });
			const chatOff = setup({ toggles: [{ organizationId: null, isEnabled: true }, { organizationId: 'org', isEnabled: false }] });
			expect(await chatOff.service.receive(chatOff.token, { text: 'x' }, 10)).toEqual({ status: 404, body: 'no_webhook' });
			expect(chatOff.repositories.FeatureOrganization.find).toHaveBeenCalledWith(expect.objectContaining({ where: { featureId: 'f-chat', tenantId: 'ten' } }));
			expect(chatOff.repositories.Feature.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { code: FeatureEnum.FEATURE_CHAT } }));
			const tenantOn = setup({ toggles: [{ organizationId: null, isEnabled: true }] });
			expect((await tenantOn.service.receive(tenantOn.token, { text: 'x' }, 10)).status).toBe(200);
			// No toggle stored for the tenant: the deployment's configured state decides, as for every chat route.
			mockToggles['FEATURE_CHAT'] = false;
			const configuredOff = setup();
			expect(await configuredOff.service.receive(configuredOff.token, { text: 'x' }, 10)).toEqual({ status: 404, body: 'no_webhook' });
			mockToggles['FEATURE_CHAT'] = true;
			// A toggle that cannot be read refuses the post.
			const unreadable = setup();
			unreadable.repositories.Feature.findOne.mockRejectedValueOnce(new Error('connection lost'));
			expect(await unreadable.service.receive(unreadable.token, { text: 'x' }, 10)).toEqual({ status: 404, body: 'no_webhook' });
		});

		it('answers 410 channel_is_archived for an archived channel', async () => {
			const { service, token, writer, repositories } = setup({ conversation: { archivedAt: new Date() } });
			expect(await service.receive(token, { text: 'x' }, 10)).toEqual({ status: 410, body: 'channel_is_archived' });
			expect(writer.post).not.toHaveBeenCalled();
			await settle();
			expect(repositories.ChatWebhook.increment).toHaveBeenCalledWith({ id: 'w1' }, 'rejectedCount', 1);
		});

		it('answers 429 with Retry-After when the limiter refuses, per webhook and organization', async () => {
			const { service, token, writer, limiter, repositories } = setup();
			limiter.take.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 7 });
			expect(await service.receive(token, { text: 'x' }, 10)).toEqual({ status: 429, body: 'rate_limited', retryAfterSeconds: 7 });
			expect(limiter.take).toHaveBeenCalledWith('w1', 'org');
			expect(writer.post).not.toHaveBeenCalled();
			await settle();
			expect(repositories.ChatWebhook.increment).toHaveBeenCalledWith({ id: 'w1' }, 'rateLimitedCount', 1);
		});

		it('answers 422 with the code for an invalid or oversized payload', async () => {
			const { service, token, writer } = setup();
			expect(await service.receive(token, { text: 'x' }, 64 * 1024 + 1)).toEqual({ status: 422, body: 'payload_too_large' });
			expect(await service.receive(token, { text: 'x', blocks: Array(51).fill({ type: 'divider' }) }, 100)).toEqual({ status: 422, body: 'too_many_blocks' });
			expect(await service.receive(token, {}, 2)).toEqual({ status: 422, body: 'no_text' });
			expect(await service.receive(token, 'text', 4)).toEqual({ status: 422, body: 'invalid_payload' });
			expect(writer.post).not.toHaveBeenCalled();
		});

		it('passes the Idempotency-Key header as the nonce, and broadcasts only for a webhook allowed to', async () => {
			const quiet = setup();
			await quiet.service.receive(quiet.token, { text: '<!channel> deploy' }, 20, 'key-12345');
			expect(quiet.writer.post.mock.calls[0][2]).toEqual({ body: '@channel deploy', blocks: [], nonce: 'key-12345' });
			const loud = setup({ webhook: { canBroadcast: true } });
			await loud.service.receive(loud.token, { text: '<!channel> deploy' }, 20);
			expect(loud.writer.post.mock.calls[0][2].body).toBe('<!channel> deploy');
		});
	});

	describe('management', () => {
		it('creates a webhook: the URL and the signing secret once, only their hash / seal stored, an activity log entry', async () => {
			const { service, repositories, activityLog } = setup();
			const result = await service.create(manager, 'c1', { name: '  Deploys  ', iconUrl: 'https://cdn.example.com/ci.png' });
			const saved = repositories.ChatWebhook.save.mock.calls[0][0] as unknown as { id: string; tokenHash: string; signingSecret: string };
			const token = String(result.url).split('/').pop() as string;
			expect(result.url).toBe(`https://api.example.com/api/chat/hooks/${token}`);
			expect(saved.tokenHash).toBe(webhookTokenHash(token));
			expect(JSON.stringify(saved)).not.toContain(token);
			expect(result.signingSecret).toMatch(/^gzcws_/);
			expect(saved.signingSecret).toMatch(/^cw1:k:/);
			expect(JSON.stringify(saved)).not.toContain(result.signingSecret as string);
			expect(result.webhook).toEqual(expect.objectContaining({ name: 'Deploys', iconUrl: 'https://cdn.example.com/ci.png', hasSigningSecret: true, tokenHint: token.slice(-4) }));
			expect(result.webhook).not.toHaveProperty('tokenHash');
			expect(result.webhook).not.toHaveProperty('signingSecret');
			// The count and the insert run under the channel's row lock.
			expect(repositories.ChatConversation.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1' }, lock: { mode: 'pessimistic_write' } }));
			expect(activityLog.logActivity).toHaveBeenCalledWith(BaseEntityEnum.ChatWebhook, ActionTypeEnum.Created, expect.anything(), saved.id, 'Deploys', expect.objectContaining({ conversationId: 'c1' }), 'org', 'ten', undefined, undefined);
		});

		it('refuses a direct conversation, an eleventh webhook, an unsafe icon or a private interaction URL', async () => {
			const direct = setup({ conversation: { kind: ChatConversationKindEnum.DIRECT } });
			await expect(direct.service.create(manager, 'c1', { name: 'x' })).rejects.toThrow(BadRequestException);
			const full = setup({ active: 10 });
			await expect(full.service.create(manager, 'c1', { name: 'x' })).rejects.toThrow(/at most 10/);
			const { service } = setup();
			await expect(service.create(manager, 'c1', { name: 'x', iconUrl: 'http://cdn.example.com/a.png' })).rejects.toThrow(/icon/);
			await expect(service.create(manager, 'c1', { name: 'x', interactionUrl: 'https://10.0.0.5/hook' })).rejects.toThrow(/public host/);
			await expect(service.create(manager, 'c1', { name: 'x', interactionUrl: 'http://hooks.example.com/x' })).rejects.toThrow(/https/);
			await expect(service.create(manager, 'c1', { name: '   ' })).rejects.toThrow(/name/);
		});

		it('leaves a non-manager out (the access rule answers)', async () => {
			const { service, access } = setup();
			access.requireManager.mockRejectedValueOnce(new ForbiddenException('Only a manager of this conversation can do that.'));
			await expect(service.list(manager, 'c1')).rejects.toThrow(ForbiddenException);
		});

		it('revokes once, keeps the row, and logs it', async () => {
			const { service, repositories, activityLog } = setup();
			const result = await service.revoke(manager, 'w1');
			expect(result.webhook.revokedAt).toEqual(expect.any(Date));
			expect(repositories.ChatWebhook.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'w1', tenantId: 'ten' }), expect.objectContaining({ revokedAt: expect.any(Date), revokedByEmployeeId: 'e1' }));
			expect(activityLog.logActivity).toHaveBeenCalledWith(BaseEntityEnum.ChatWebhook, ActionTypeEnum.Deleted, expect.anything(), 'w1', 'Deploys', expect.anything(), 'org', 'ten', undefined, undefined);
			const already = setup({ webhook: { revokedAt: new Date() } });
			await already.service.revoke(manager, 'w1');
			expect(already.repositories.ChatWebhook.update).not.toHaveBeenCalled();
			await expect(already.service.update(manager, 'w1', { name: 'y' })).rejects.toThrow(/revoked/);
		});

		it('renames with the previous values in the log, and hides the routes when webhooks are off', async () => {
			const { service, activityLog, repositories } = setup();
			const result = await service.update(manager, 'w1', { name: 'Releases' });
			expect(result.webhook.name).toBe('Releases');
			// Only the named field is written: a concurrent change of another field is kept.
			expect(repositories.ChatWebhook.update).toHaveBeenCalledWith({ id: 'w1', tenantId: 'ten' }, { name: 'Releases' });
			expect(activityLog.logActivity).toHaveBeenCalledWith(
				BaseEntityEnum.ChatWebhook,
				ActionTypeEnum.Updated,
				expect.anything(),
				'w1',
				'Releases',
				expect.anything(),
				'org',
				'ten',
				expect.objectContaining({ name: 'Deploys' }),
				expect.objectContaining({ name: 'Releases' })
			);
			process.env['GAUZY_CHAT_WEBHOOKS_ENABLED'] = '';
			await expect(service.list(manager, 'c1')).rejects.toThrow(/not found/);
		});
	});
});
