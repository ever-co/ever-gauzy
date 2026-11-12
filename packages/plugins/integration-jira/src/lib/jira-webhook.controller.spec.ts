jest.mock('@gauzy/core', () => ({ EVER_REDIS_CLIENT: 'EVER_REDIS_CLIENT' }));
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));
jest.mock('./sync/jira-sync.service', () => ({ JiraSyncService: class JiraSyncService {} }));
jest.mock('./jira-tenant.service', () => ({ JiraTenantService: class JiraTenantService {} }));

import { createHmac } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { JiraCloudConfig } from './jira-config';
import { JiraWebhookController } from './jira-webhook.controller';
import { JiraWebhookDedupeService } from './jira-webhook-dedupe.service';
import { deliveryIdOf, isDeliveryForWebhooks, issueOfDelivery, signJiraWebhookToken, verifyJiraWebhookToken } from './jira-webhook.verification';
import { JIRA_WEBHOOK_DEDUPE_MS } from './jira.constants';

const SECRET = 'client-secret';
const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const seconds = Math.floor(NOW / 1000);

describe('verifyJiraWebhookToken', () => {
	it('accepts a bearer token signed (HS256) with the client secret, within its life', () => {
		const token = signJiraWebhookToken(SECRET, { iss: 'jira', iat: seconds - 5, exp: seconds + 180 });
		expect(verifyJiraWebhookToken(SECRET, `Bearer ${token}`, NOW)).toEqual({ valid: true, claims: { iss: 'jira', iat: seconds - 5, exp: seconds + 180 } });
		expect(verifyJiraWebhookToken(SECRET, `JWT ${token}`, NOW).valid).toBe(true);
		// No `exp`: accepted on its signature (the delivery id still makes a replay a no-op).
		expect(verifyJiraWebhookToken(SECRET, `Bearer ${signJiraWebhookToken(SECRET, {})}`, NOW).valid).toBe(true);
	});

	it('refuses a missing, malformed or foreign token, and a tampered one', () => {
		const token = signJiraWebhookToken(SECRET, { exp: seconds + 60 });
		expect(verifyJiraWebhookToken(SECRET, undefined, NOW)).toEqual({ valid: false, reason: 'missing' });
		expect(verifyJiraWebhookToken(SECRET, 'Basic abc', NOW)).toEqual({ valid: false, reason: 'malformed' });
		expect(verifyJiraWebhookToken(SECRET, `Bearer ${token}x.y`, NOW)).toEqual({ valid: false, reason: 'malformed' });
		expect(verifyJiraWebhookToken('another-secret', `Bearer ${token}`, NOW)).toEqual({ valid: false, reason: 'signature' });
		const [head, , signature] = token.split('.');
		const forged = Buffer.from(JSON.stringify({ exp: seconds + 9999, admin: true })).toString('base64url');
		expect(verifyJiraWebhookToken(SECRET, `Bearer ${head}.${forged}.${signature}`, NOW)).toEqual({ valid: false, reason: 'signature' });
	});

	it('refuses any algorithm but HS256 (`none`, or an asymmetric one the secret would be misread as a key of)', () => {
		const none = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${Buffer.from('{}').toString('base64url')}.${Buffer.from('x').toString('base64url')}`;
		expect(verifyJiraWebhookToken(SECRET, `Bearer ${none}`, NOW)).toEqual({ valid: false, reason: 'algorithm' });
		expect(verifyJiraWebhookToken(SECRET, `Bearer ${signJiraWebhookToken(SECRET, {}, 'RS256')}`, NOW)).toEqual({ valid: false, reason: 'algorithm' });
	});

	it('refuses an expired token, and one not valid yet, beyond a minute of clock difference', () => {
		expect(verifyJiraWebhookToken(SECRET, `Bearer ${signJiraWebhookToken(SECRET, { exp: seconds - 30 })}`, NOW).valid).toBe(true);
		expect(verifyJiraWebhookToken(SECRET, `Bearer ${signJiraWebhookToken(SECRET, { exp: seconds - 120 })}`, NOW)).toEqual({ valid: false, reason: 'expired' });
		expect(verifyJiraWebhookToken(SECRET, `Bearer ${signJiraWebhookToken(SECRET, { nbf: seconds + 300 })}`, NOW)).toEqual({ valid: false, reason: 'not_yet_valid' });
		expect(verifyJiraWebhookToken(SECRET, `Bearer ${signJiraWebhookToken(SECRET, { iat: seconds + 300 })}`, NOW)).toEqual({ valid: false, reason: 'not_yet_valid' });
	});

	it('signs exactly as a JWT library does (HMAC-SHA256 over header.payload, base64url)', () => {
		const token = signJiraWebhookToken(SECRET, { a: 1 });
		const [head, body, signature] = token.split('.');
		expect(signature).toBe(createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url'));
	});
});

describe('what a delivery is about', () => {
	it('names the issue of an issue or comment event, and its project when the delivery carries it', () => {
		expect(issueOfDelivery({ webhookEvent: 'jira:issue_updated', issue: { id: '10001', fields: { project: { id: 10000 } } } })).toEqual({ issueId: '10001', projectId: '10000' });
		expect(issueOfDelivery({ webhookEvent: 'jira:issue_created', issue: { id: 10002 } })).toEqual({ issueId: '10002', projectId: null });
		expect(issueOfDelivery({ webhookEvent: 'comment_created', issue: { id: '10003', key: 'A-3' } })).toEqual({ issueId: '10003', projectId: null });
	});

	it('applies nothing for a deletion, another event, or an issue id that is not Jira’s', () => {
		expect(issueOfDelivery({ webhookEvent: 'jira:issue_deleted', issue: { id: '10001' } })).toBeNull();
		expect(issueOfDelivery({ webhookEvent: 'comment_deleted', issue: { id: '10001' } })).toBeNull();
		expect(issueOfDelivery({ webhookEvent: 'sprint_started' })).toBeNull();
		expect(issueOfDelivery({ webhookEvent: 'jira:issue_updated', issue: { id: '../etc' } })).toBeNull();
	});

	it('takes a delivery through one of the connection’s webhooks only (when both sides name some)', () => {
		expect(isDeliveryForWebhooks({ matchedWebhookIds: [1001] }, ['1001', '1002'])).toBe(true);
		expect(isDeliveryForWebhooks({ matchedWebhookIds: [999] }, ['1001'])).toBe(false);
		expect(isDeliveryForWebhooks({}, ['1001'])).toBe(true);
		expect(isDeliveryForWebhooks({ matchedWebhookIds: [999] }, [])).toBe(true);
	});

	it('reads the delivery id Jira keeps across its retries', () => {
		expect(deliveryIdOf(' 5b6a6d2c-5f1b-4f0e-9b5e-1a2b3c4d5e6f ')).toBe('5b6a6d2c-5f1b-4f0e-9b5e-1a2b3c4d5e6f');
		expect(deliveryIdOf(['a-1', 'b'])).toBe('a-1');
		expect(deliveryIdOf('has spaces')).toBeNull();
		expect(deliveryIdOf(undefined)).toBeNull();
	});
});

describe('JiraWebhookController: what a delivery must be', () => {
	it('answers 400 for a body that is JSON but no delivery object (null, an array, a bare value)', async () => {
		const config = { clientId: 'id', clientSecret: SECRET, redirectUrl: 'https://api.example.com/cb', webhookBaseUrl: 'https://api.example.com/api/integration/jira/webhook' } as JiraCloudConfig;
		const tenants = { findAnyById: jest.fn(), webhookIdsOf: jest.fn(() => []) };
		const controller = new JiraWebhookController(config, tenants as never, {} as never, new JiraWebhookDedupeService(null));
		const token = `Bearer ${signJiraWebhookToken(SECRET, { iat: Math.floor(Date.now() / 1000) })}`;
		for (const body of ['null', '[]', '42']) {
			await expect(controller.receive('0f8a4a0e-5b8a-4c2e-9d55-1f2a3b4c5d6e', { rawBody: Buffer.from(body) } as never, token, 'delivery-1')).rejects.toMatchObject({ status: 400 });
		}
		expect(tenants.findAnyById).not.toHaveBeenCalled();
	});
});

describe('JiraWebhookDedupeService', () => {
	it('claims a delivery once in this process, releases it for a retry, and forgets it after the window', async () => {
		const deliveries = new JiraWebhookDedupeService(null);
		expect(await deliveries.claim('c1', 'd1', NOW)).toBe(true);
		expect(await deliveries.claim('c1', 'd1', NOW + 1000)).toBe(false);
		// Another connection's delivery of the same id is its own.
		expect(await deliveries.claim('c2', 'd1', NOW)).toBe(true);
		await deliveries.release('c1', 'd1');
		expect(await deliveries.claim('c1', 'd1', NOW + 2000)).toBe(true);
		expect(await deliveries.claim('c1', 'd1', NOW + 2000 + JIRA_WEBHOOK_DEDUPE_MS + 1)).toBe(true);
	});

	it('claims with an atomic SET NX across replicas, and never refuses a delivery when Redis does not answer', async () => {
		const set = jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('down'));
		const del = jest.fn().mockResolvedValue(1);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		const deliveries = new JiraWebhookDedupeService({ set, del } as never);
		expect(await deliveries.claim('c1', 'd1')).toBe(true);
		expect(set).toHaveBeenCalledWith('jira_webhook_delivery:c1:d1', expect.any(String), { NX: true, PX: JIRA_WEBHOOK_DEDUPE_MS });
		expect(await deliveries.claim('c1', 'd1')).toBe(false);
		expect(await deliveries.claim('c1', 'd2')).toBe(true);
		await deliveries.release('c1', 'd1');
		expect(del).toHaveBeenCalledWith('jira_webhook_delivery:c1:d1');
	});
});

describe('JiraWebhookController', () => {
	const integrationId = '7f3c9a3e-1d2b-4c5d-8e9f-0a1b2c3d4e5f';
	const config = { clientId: 'id', clientSecret: SECRET, redirectUrl: 'https://api.example.com/cb', webhookBaseUrl: 'https://api.example.com/api/integration/jira/webhook' } as JiraCloudConfig;
	const body = (payload: unknown) => ({ rawBody: Buffer.from(JSON.stringify(payload)) }) as never;
	const bearer = () => `Bearer ${signJiraWebhookToken(SECRET, { exp: Math.floor(Date.now() / 1000) + 60 })}`;

	function controller(options: { webhookIds?: string[]; outcome?: { applied: boolean; error: string | null } } = {}) {
		const tenant = { id: integrationId, tenantId: 't1', organizationId: 'o1', settings: [] };
		const tenants = { findAnyById: jest.fn().mockResolvedValue(tenant), webhookIdsOf: jest.fn(() => options.webhookIds ?? ['1001']) };
		const applyIssueFromWebhook = jest.fn().mockResolvedValue(options.outcome ?? { applied: true, error: null });
		const deliveries = new JiraWebhookDedupeService(null);
		const release = jest.spyOn(deliveries, 'release');
		const instance = new JiraWebhookController(config, tenants as never, { applyIssueFromWebhook } as never, deliveries);
		return { instance, tenants, applyIssueFromWebhook, release };
	}

	const flush = () => new Promise((resolve) => setImmediate(resolve));
	const payload = { webhookEvent: 'jira:issue_updated', issue: { id: '10001', fields: { project: { id: '10000' } } }, matchedWebhookIds: [1001] };

	beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('acknowledges a verified delivery at once and applies its issue behind the answer', async () => {
		const { instance, applyIssueFromWebhook } = controller();
		await expect(instance.receive(integrationId, body(payload), bearer(), 'd-1')).resolves.toEqual({ accepted: true, queued: true });
		await flush();
		await flush();
		expect(applyIssueFromWebhook).toHaveBeenCalledWith(expect.objectContaining({ id: integrationId }), '10001', '10000');
	});

	it('applies a delivery Jira retries once (the same identifier)', async () => {
		const { instance, applyIssueFromWebhook } = controller();
		await instance.receive(integrationId, body(payload), bearer(), 'd-2');
		await expect(instance.receive(integrationId, body(payload), bearer(), 'd-2')).resolves.toEqual({ accepted: true, queued: false, duplicate: true });
		await flush();
		await flush();
		expect(applyIssueFromWebhook).toHaveBeenCalledTimes(1);
	});

	it('releases a delivery whose apply failed, so Jira’s retry is applied after all', async () => {
		const { instance, release, applyIssueFromWebhook } = controller({ outcome: { applied: false, error: 'boom' } });
		await instance.receive(integrationId, body(payload), bearer(), 'd-3');
		await flush();
		await flush();
		await flush();
		expect(release).toHaveBeenCalledWith(integrationId, 'd-3');
		await expect(instance.receive(integrationId, body(payload), bearer(), 'd-3')).resolves.toEqual({ accepted: true, queued: true });
		await flush();
		await flush();
		expect(applyIssueFromWebhook).toHaveBeenCalledTimes(2);
	});

	it('refuses an unsigned or wrongly signed delivery before reading the connection', async () => {
		const { instance, tenants } = controller();
		await expect(instance.receive(integrationId, body(payload), undefined, 'd-4')).rejects.toMatchObject({ status: 401 });
		await expect(instance.receive(integrationId, body(payload), `Bearer ${signJiraWebhookToken('nope', {})}`, 'd-4')).rejects.toMatchObject({ status: 401 });
		expect(tenants.findAnyById).not.toHaveBeenCalled();
	});

	it('answers 404 for a path that names no connection, and 400 for a body that is not JSON', async () => {
		const { instance, tenants } = controller();
		await expect(instance.receive('not-a-uuid', body(payload), bearer(), 'd-5')).rejects.toMatchObject({ status: 404 });
		tenants.findAnyById.mockResolvedValueOnce(null);
		await expect(instance.receive(integrationId, body(payload), bearer(), 'd-5')).rejects.toMatchObject({ status: 404 });
		await expect(instance.receive(integrationId, { rawBody: Buffer.from('{nope') } as never, bearer(), 'd-5')).rejects.toMatchObject({ status: 400 });
	});

	it('leaves alone a delivery of a webhook the connection no longer holds, and an event that names no issue', async () => {
		const { instance, applyIssueFromWebhook } = controller({ webhookIds: ['2002'] });
		await expect(instance.receive(integrationId, body(payload), bearer(), 'd-6')).resolves.toEqual({ accepted: true, queued: false });
		await expect(instance.receive(integrationId, body({ ...payload, webhookEvent: 'jira:issue_deleted', matchedWebhookIds: [2002] }), bearer(), 'd-7')).resolves.toEqual({ accepted: true, queued: false });
		await flush();
		expect(applyIssueFromWebhook).not.toHaveBeenCalled();
	});

	it('refuses every delivery while webhooks are off (no HTTPS address)', async () => {
		const tenants = { findAnyById: jest.fn(), webhookIdsOf: jest.fn(() => []) };
		const off = new JiraWebhookController({ ...config, webhookBaseUrl: 'http://localhost:3000/api/integration/jira/webhook' }, tenants as never, {} as never, new JiraWebhookDedupeService(null));
		await expect(off.receive(integrationId, body(payload), bearer(), 'd-8')).rejects.toMatchObject({ status: 401 });
	});
});
