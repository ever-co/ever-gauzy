import { Logger } from '@nestjs/common';
import { JiraApiError } from '../client/jira-api.client';
import { JiraProjectMapping, JiraSyncDirection } from '../entities/jira-project-mapping.entity';
import { JiraCloudConfig } from '../jira-config';
import { JIRA_WEBHOOK_EVENTS, JIRA_WEBHOOK_LIFETIME_MS, JIRA_WEBHOOK_REFRESH_AHEAD_MS, JiraSettingName } from '../jira.constants';
import { isWebhookRefreshDue, JiraWebhookService, webhookJqlOf } from './jira-webhook.service';

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const TARGET = 'https://api.example.com/api/integration/jira/webhook/int-1';
const config = {
	clientId: 'id',
	clientSecret: 'secret',
	redirectUrl: 'https://api.example.com/cb',
	webhookBaseUrl: 'https://api.example.com/api/integration/jira/webhook'
} as JiraCloudConfig;

const mapping = (jiraProjectId: string, direction = JiraSyncDirection.INBOUND, syncEnabled = true) => ({ jiraProjectId, direction, syncEnabled }) as JiraProjectMapping;

describe('webhookJqlOf', () => {
	it('filters the projects the inbound mappings bring in, each once, in order', () => {
		expect(webhookJqlOf([mapping('10010'), mapping('10002', JiraSyncDirection.BOTH), mapping('10010')])).toBe('project in (10002, 10010)');
	});

	it('wants no webhook for mappings that send out only, are switched off, or name no Jira project id', () => {
		expect(webhookJqlOf([mapping('10010', JiraSyncDirection.OUTBOUND), mapping('10011', JiraSyncDirection.INBOUND, false), mapping('KEY')])).toBeNull();
		expect(webhookJqlOf([])).toBeNull();
	});
});

describe('isWebhookRefreshDue', () => {
	it('refreshes a webhook within a week of its 30-day expiry, and one whose expiry is unknown', () => {
		expect(isWebhookRefreshDue(new Date(NOW + JIRA_WEBHOOK_REFRESH_AHEAD_MS + 60_000).toISOString(), NOW)).toBe(false);
		expect(isWebhookRefreshDue(new Date(NOW + JIRA_WEBHOOK_REFRESH_AHEAD_MS - 60_000).toISOString(), NOW)).toBe(true);
		expect(isWebhookRefreshDue(null, NOW)).toBe(true);
		expect(isWebhookRefreshDue('garbage', NOW)).toBe(true);
	});
});

describe('JiraWebhookService', () => {
	function harness(values: Partial<Record<JiraSettingName, string>>, mappings: JiraProjectMapping[]) {
		const settings: Partial<Record<JiraSettingName, string>> = { [JiraSettingName.JIRA_CLOUD_ID]: 'cloud-1', ...values };
		const tenant = { id: 'int-1', tenantId: 't1', organizationId: 'o1' };
		const client = {
			registerWebhooks: jest.fn().mockResolvedValue([{ createdWebhookId: 2001 }]),
			refreshWebhooks: jest.fn().mockResolvedValue('2026-12-11T12:00:00.000Z'),
			deleteWebhooks: jest.fn().mockResolvedValue(undefined)
		};
		const recorded: Array<{ ids: readonly string[]; jql: string; url?: string | null; expiresAt: string | null; error: string | null }> = [];
		const tenants = {
			// Each look reads the connection again (the settings below are what the store holds).
			findAnyById: jest.fn(async () => tenant),
			settingsOf: jest.fn(() => settings),
			webhookIdsOf: jest.fn(() => (settings[JiraSettingName.WEBHOOK_IDS] ?? '').split(',').filter(Boolean)),
			clientReady: jest.fn(async () => client),
			refreshAccessToken: jest.fn(async () => null),
			recordWebhook: jest.fn(async (_tenant: unknown, webhook: (typeof recorded)[number]) => void recorded.push(webhook)),
			recordWebhookError: jest.fn(async () => undefined),
			setAttention: jest.fn(async () => undefined)
		};
		const repository = { find: jest.fn(async () => mappings) };
		const service = new JiraWebhookService(tenants as never, repository as never, config);
		return { service, tenant, client, tenants, recorded, repository };
	}

	beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('registers one webhook for the connection’s inbound projects, delivered to its own address', async () => {
		const { service, tenant, client, recorded } = harness({}, [mapping('10000'), mapping('10001', JiraSyncDirection.BOTH)]);
		expect(await service.ensure(tenant as never, NOW)).toBe('registered');
		expect(client.registerWebhooks).toHaveBeenCalledWith('https://api.example.com/api/integration/jira/webhook/int-1', [{ events: JIRA_WEBHOOK_EVENTS, jqlFilter: 'project in (10000, 10001)' }]);
		expect(recorded).toEqual([
			{ ids: ['2001'], jql: 'project in (10000, 10001)', url: TARGET, expiresAt: new Date(NOW + JIRA_WEBHOOK_LIFETIME_MS).toISOString(), error: null }
		]);
	});

	it('leaves a webhook alone while its filter holds and its expiry is far', async () => {
		const { service, tenant, client } = harness(
			{
				[JiraSettingName.WEBHOOK_IDS]: '2001',
				[JiraSettingName.WEBHOOK_JQL]: 'project in (10000)',
				[JiraSettingName.WEBHOOK_URL]: TARGET,
				[JiraSettingName.WEBHOOK_EXPIRES_AT]: new Date(NOW + 20 * 86_400_000).toISOString()
			},
			[mapping('10000')]
		);
		expect(await service.ensure(tenant as never, NOW)).toBe('unchanged');
		expect(client.registerWebhooks).not.toHaveBeenCalled();
		expect(client.refreshWebhooks).not.toHaveBeenCalled();
	});

	it('refreshes a webhook near its expiry, keeping its id', async () => {
		const { service, tenant, client, recorded } = harness(
			{
				[JiraSettingName.WEBHOOK_IDS]: '2001',
				[JiraSettingName.WEBHOOK_JQL]: 'project in (10000)',
				[JiraSettingName.WEBHOOK_URL]: TARGET,
				[JiraSettingName.WEBHOOK_EXPIRES_AT]: new Date(NOW + 86_400_000).toISOString()
			},
			[mapping('10000')]
		);
		expect(await service.ensure(tenant as never, NOW)).toBe('refreshed');
		expect(client.refreshWebhooks).toHaveBeenCalledWith(['2001']);
		expect(recorded[0]).toEqual({ ids: ['2001'], jql: 'project in (10000)', url: TARGET, expiresAt: '2026-12-11T12:00:00.000Z', error: null });
	});

	it('registers the webhook again when Jira no longer knows the one it refreshes', async () => {
		const { service, tenant, client } = harness(
			{ [JiraSettingName.WEBHOOK_IDS]: '2001', [JiraSettingName.WEBHOOK_JQL]: 'project in (10000)', [JiraSettingName.WEBHOOK_URL]: TARGET },
			[mapping('10000')]
		);
		client.refreshWebhooks.mockRejectedValueOnce(new JiraApiError('Webhook not found', 404));
		// Jira no longer knows it: deleting it answers 404 too, which is no reason to stop.
		client.deleteWebhooks.mockRejectedValueOnce(new JiraApiError('Webhook not found', 404));
		expect(await service.ensure(tenant as never, NOW)).toBe('registered');
		expect(client.deleteWebhooks).toHaveBeenCalledWith(['2001']);
		expect(client.registerWebhooks).toHaveBeenCalledTimes(1);
	});

	it('registers the webhook again when its address changed (JIRA_WEBHOOK_URL, API_BASE_URL), though its filter holds', async () => {
		const { service, tenant, client, recorded } = harness(
			{
				[JiraSettingName.WEBHOOK_IDS]: '2001',
				[JiraSettingName.WEBHOOK_JQL]: 'project in (10000)',
				[JiraSettingName.WEBHOOK_URL]: 'https://old.example.com/api/integration/jira/webhook/int-1',
				[JiraSettingName.WEBHOOK_EXPIRES_AT]: new Date(NOW + 20 * 86_400_000).toISOString()
			},
			[mapping('10000')]
		);
		expect(await service.ensure(tenant as never, NOW)).toBe('registered');
		expect(client.deleteWebhooks).toHaveBeenCalledWith(['2001']);
		expect(client.registerWebhooks.mock.calls[0][0]).toBe(TARGET);
		expect(recorded[0]).toMatchObject({ ids: ['2001'], url: TARGET });
	});

	it('keeps the former webhook when Jira refuses to delete it: no second one is registered beside it', async () => {
		const { service, tenant, client, recorded, tenants } = harness({ [JiraSettingName.WEBHOOK_IDS]: '2001', [JiraSettingName.WEBHOOK_JQL]: 'project in (10000)' }, [mapping('10000'), mapping('10005')]);
		client.deleteWebhooks.mockRejectedValueOnce(new JiraApiError('Service unavailable', 503));
		expect(await service.ensure(tenant as never, NOW)).toBe('failed');
		expect(client.registerWebhooks).not.toHaveBeenCalled();
		expect(recorded).toEqual([]);
		expect(tenants.recordWebhookError).toHaveBeenCalled();
	});

	it('removes a webhook it registered but could not record (its id would be lost)', async () => {
		const { service, tenant, client, tenants } = harness({}, [mapping('10000')]);
		tenants.recordWebhook.mockRejectedValueOnce(new Error('store down'));
		expect(await service.ensure(tenant as never, NOW)).toBe('failed');
		expect(client.registerWebhooks).toHaveBeenCalledTimes(1);
		expect(client.deleteWebhooks).toHaveBeenCalledWith(['2001']);
	});

	it('replaces the registration when the mappings change, and removes it when none brings issues in', async () => {
		const changed = harness({ [JiraSettingName.WEBHOOK_IDS]: '2001', [JiraSettingName.WEBHOOK_JQL]: 'project in (10000)' }, [mapping('10000'), mapping('10005')]);
		expect(await changed.service.ensure(changed.tenant as never, NOW)).toBe('registered');
		expect(changed.client.deleteWebhooks).toHaveBeenCalledWith(['2001']);
		expect(changed.client.registerWebhooks.mock.calls[0][1][0].jqlFilter).toBe('project in (10000, 10005)');
		const gone = harness({ [JiraSettingName.WEBHOOK_IDS]: '2001', [JiraSettingName.WEBHOOK_JQL]: 'project in (10000)' }, [mapping('10000', JiraSyncDirection.OUTBOUND)]);
		expect(await gone.service.ensure(gone.tenant as never, NOW)).toBe('removed');
		expect(gone.recorded).toEqual([{ ids: [], jql: '', expiresAt: null, error: null }]);
	});

	it('records why Jira registered nothing, and marks a refused token on the connection', async () => {
		const refused = harness({}, [mapping('10000')]);
		refused.client.registerWebhooks.mockResolvedValueOnce([{ errors: ['The URL must use the app base URL'] }]);
		expect(await refused.service.ensure(refused.tenant as never, NOW)).toBe('failed');
		expect(refused.recorded[0].error).toBe('The URL must use the app base URL');
		const unauthorized = harness({}, [mapping('10000')]);
		unauthorized.client.registerWebhooks.mockRejectedValue(new JiraApiError('Unauthorized', 401));
		expect(await unauthorized.service.ensure(unauthorized.tenant as never, NOW)).toBe('failed');
		expect(unauthorized.tenants.refreshAccessToken).toHaveBeenCalled();
		expect(unauthorized.tenants.setAttention).toHaveBeenCalledWith(unauthorized.tenant, 'token_refused', null);
	});

	it('does nothing for a connection without a site, or waiting for a person', async () => {
		const pending = harness({ [JiraSettingName.JIRA_CLOUD_ID]: '' }, [mapping('10000')]);
		expect(await pending.service.ensure(pending.tenant as never, NOW)).toBe('off');
		const refused = harness({ [JiraSettingName.ATTENTION_REASON]: 'token_refused' }, [mapping('10000')]);
		expect(await refused.service.ensure(refused.tenant as never, NOW)).toBe('off');
		expect(refused.client.registerWebhooks).not.toHaveBeenCalled();
	});

	it('removes the connection’s webhooks on a disconnect, and says when Jira kept them', async () => {
		const { service, tenant, client } = harness({ [JiraSettingName.WEBHOOK_IDS]: '2001,2002' }, []);
		expect(await service.remove(tenant as never)).toBe(true);
		expect(client.deleteWebhooks).toHaveBeenCalledWith(['2001', '2002']);
		client.deleteWebhooks.mockRejectedValueOnce(new JiraApiError('down', 503));
		expect(await service.remove(tenant as never)).toBe(false);
	});

	it('looks at one connection once at a time: two quick mapping changes register once', async () => {
		const { service, tenant, client, recorded, tenants } = harness({}, [mapping('10000')]);
		// The second look sees what the first recorded.
		tenants.recordWebhook.mockImplementation(async (_tenant: unknown, webhook: (typeof recorded)[number]) => {
			recorded.push(webhook);
			(tenants.settingsOf() as Record<string, string>)[JiraSettingName.WEBHOOK_IDS] = webhook.ids.join(',');
			(tenants.settingsOf() as Record<string, string>)[JiraSettingName.WEBHOOK_JQL] = webhook.jql;
			(tenants.settingsOf() as Record<string, string>)[JiraSettingName.WEBHOOK_URL] = webhook.url ?? '';
			(tenants.settingsOf() as Record<string, string>)[JiraSettingName.WEBHOOK_EXPIRES_AT] = webhook.expiresAt ?? '';
		});
		const outcomes = await Promise.all([service.ensure(tenant as never, NOW), service.ensure(tenant as never, NOW)]);
		expect(outcomes).toEqual(['registered', 'unchanged']);
		expect(client.registerWebhooks).toHaveBeenCalledTimes(1);
	});
});
