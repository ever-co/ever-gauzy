import { Logger } from '@nestjs/common';
import { JiraApiClient } from './client/jira-api.client';
import { JiraCloudConfig } from './jira-config';
import { JiraTenantService } from './jira-tenant.service';
import { JIRA_SITE_REQUIRED, JiraSettingName } from './jira.constants';

const config = {
	clientId: 'client-id',
	clientSecret: 'client-secret',
	redirectUrl: 'https://api.example.com/api/integration/jira/callback',
	apiUrl: 'https://gateway.test',
	tokenUrl: 'https://auth.test/oauth/token'
} as JiraCloudConfig;

type Setting = { id: string; settingsName: string; settingsValue: string };

/** The service over a connection row whose settings the store writes back as it is asked. */
function harness(values: Partial<Record<JiraSettingName, string>>) {
	const settings: Setting[] = Object.entries(values).map(([settingsName, settingsValue], index) => ({ id: `set-${index}`, settingsName, settingsValue: settingsValue as string }));
	const row = { id: 'int-1', tenantId: 'tenant-1', organizationId: 'org-1', settings };
	/** What the store holds now (another process may have written it). */
	const stored = { row: JSON.parse(JSON.stringify(row)) as typeof row };
	const integrationTenantService = { typeOrmRepository: { findOne: jest.fn(async () => JSON.parse(JSON.stringify(stored.row))) } };
	let created = 0;
	const integrationSettingService = {
		update: jest.fn(async (id: string, input: { settingsValue: string }) => {
			const setting = stored.row.settings.find((candidate) => candidate.id === id);
			if (setting) setting.settingsValue = input.settingsValue;
			return { affected: 1 };
		}),
		create: jest.fn(async (input: { settingsName: string; settingsValue: string }) => {
			const setting = { id: `set-new-${++created}`, settingsName: input.settingsName, settingsValue: input.settingsValue };
			stored.row.settings.push(setting);
			return setting;
		})
	};
	const service = new JiraTenantService({} as never, integrationTenantService as never, integrationSettingService as never, config, null);
	const value = (name: JiraSettingName) => stored.row.settings.find((setting) => setting.settingsName === name)?.settingsValue;
	return { service, row, stored, value, integrationSettingService };
}

const soon = () => new Date(Date.now() + 60_000).toISOString();
const later = () => new Date(Date.now() + 3_600_000).toISOString();

function tokenAnswer(body: Record<string, unknown>, status = 200) {
	return { status, headers: { get: () => null }, text: async () => JSON.stringify(body) } as unknown as Response;
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('JiraTenantService — tokens and the site', () => {
	it('opens a client of the connection’s site, and refuses one while no site is chosen', () => {
		const { service, row } = harness({ [JiraSettingName.ACCESS_TOKEN]: 'at', [JiraSettingName.JIRA_CLOUD_ID]: 'cloud-1' });
		const client = service.clientFor(row as never);
		expect(client).toBeInstanceOf(JiraApiClient);
		expect(client.cloudId).toBe('cloud-1');
		const pending = harness({ [JiraSettingName.ACCESS_TOKEN]: 'at' });
		expect(() => pending.service.clientFor(pending.row as never)).toThrow(expect.objectContaining({ response: expect.objectContaining({ code: JIRA_SITE_REQUIRED }) }));
		expect(pending.service.summaryOf(pending.row as never)).toMatchObject({ siteRequired: true, cloudId: null });
	});

	it('renews an access token about to expire, rotating the refresh token (the old one is spent)', async () => {
		const { service, row, value } = harness({
			[JiraSettingName.ACCESS_TOKEN]: 'at-1',
			[JiraSettingName.REFRESH_TOKEN]: 'rt-1',
			[JiraSettingName.EXPIRES_AT]: soon(),
			[JiraSettingName.JIRA_CLOUD_ID]: 'cloud-1'
		});
		const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(tokenAnswer({ access_token: 'at-2', refresh_token: 'rt-2', expires_in: 3600, token_type: 'Bearer' }));
		expect(service.isExpiringSoon(row as never)).toBe(true);
		const client = await service.clientReady(row as never);
		expect(client.cloudId).toBe('cloud-1');
		expect(fetch).toHaveBeenCalledTimes(1);
		const [url, init] = fetch.mock.calls[0] as [string, { body: string; headers: Record<string, string> }];
		expect(url).toBe('https://auth.test/oauth/token');
		expect(init.headers['Content-Type']).toBe('application/json');
		expect(JSON.parse(init.body)).toEqual({ grant_type: 'refresh_token', client_id: 'client-id', client_secret: 'client-secret', refresh_token: 'rt-1' });
		expect(value(JiraSettingName.ACCESS_TOKEN)).toBe('at-2');
		expect(value(JiraSettingName.REFRESH_TOKEN)).toBe('rt-2');
		expect(Date.parse(value(JiraSettingName.EXPIRES_AT) as string)).toBeGreaterThan(Date.now() + 3_000_000);
		expect(service.isExpiringSoon(row as never)).toBe(false);
	});

	it('spends a refresh token once when two callers renew at the same time', async () => {
		const { service, row } = harness({ [JiraSettingName.ACCESS_TOKEN]: 'at-1', [JiraSettingName.REFRESH_TOKEN]: 'rt-1', [JiraSettingName.EXPIRES_AT]: soon(), [JiraSettingName.JIRA_CLOUD_ID]: 'c' });
		const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(tokenAnswer({ access_token: 'at-2', refresh_token: 'rt-2', expires_in: 3600 }));
		const [a, b] = await Promise.all([service.refreshAccessToken(row as never), service.refreshAccessToken(row as never)]);
		expect(a).toBe(b);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('renews nothing when another process renewed the connection meanwhile (its stored token is fresh)', async () => {
		const { service, row, stored } = harness({ [JiraSettingName.ACCESS_TOKEN]: 'at-1', [JiraSettingName.REFRESH_TOKEN]: 'rt-1', [JiraSettingName.EXPIRES_AT]: soon(), [JiraSettingName.JIRA_CLOUD_ID]: 'c' });
		for (const setting of stored.row.settings) {
			if (setting.settingsName === JiraSettingName.ACCESS_TOKEN) setting.settingsValue = 'at-other';
			if (setting.settingsName === JiraSettingName.REFRESH_TOKEN) setting.settingsValue = 'rt-other';
			if (setting.settingsName === JiraSettingName.EXPIRES_AT) setting.settingsValue = later();
		}
		const fetch = jest.spyOn(globalThis, 'fetch');
		const client = await service.refreshAccessToken(row as never);
		expect(fetch).not.toHaveBeenCalled();
		expect(client).toBeInstanceOf(JiraApiClient);
		expect(service.settingsOf(row as never)[JiraSettingName.ACCESS_TOKEN]).toBe('at-other');
	});

	it('renews a token Jira refused even far from its expiry; reuses the stored one only when another process renewed it', async () => {
		const { service, row, stored, value } = harness({ [JiraSettingName.ACCESS_TOKEN]: 'at-1', [JiraSettingName.REFRESH_TOKEN]: 'rt-1', [JiraSettingName.EXPIRES_AT]: later(), [JiraSettingName.JIRA_CLOUD_ID]: 'c' });
		const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(tokenAnswer({ access_token: 'at-2', refresh_token: 'rt-2', expires_in: 3600 }));
		const refused = service.clientFor(row as never);
		expect(refused.usesToken('at-1')).toBe(true);

		const renewed = await service.refreshAccessToken(row as never, refused);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(value(JiraSettingName.ACCESS_TOKEN)).toBe('at-2');
		expect(renewed?.usesToken('at-2')).toBe(true);

		// Refused again, but the row holds another token by now (renewed elsewhere): that one is used, nothing is spent.
		for (const setting of stored.row.settings) if (setting.settingsName === JiraSettingName.ACCESS_TOKEN) setting.settingsValue = 'at-3';
		fetch.mockClear();
		const reused = await service.refreshAccessToken(row as never, renewed);
		expect(fetch).not.toHaveBeenCalled();
		expect(reused?.usesToken('at-3')).toBe(true);
	});

	it('keeps the pair another process stored while its own exchange ran: stores nothing, and goes on with its own fresh token', async () => {
		const { service, row, stored, value } = harness({ [JiraSettingName.ACCESS_TOKEN]: 'at-1', [JiraSettingName.REFRESH_TOKEN]: 'rt-1', [JiraSettingName.EXPIRES_AT]: soon(), [JiraSettingName.JIRA_CLOUD_ID]: 'c' });
		jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
			// The other process wins the race: its pair is stored before this exchange answers.
			for (const setting of stored.row.settings) {
				if (setting.settingsName === JiraSettingName.ACCESS_TOKEN) setting.settingsValue = 'at-other';
				if (setting.settingsName === JiraSettingName.REFRESH_TOKEN) setting.settingsValue = 'rt-other';
			}
			return tokenAnswer({ access_token: 'at-mine', refresh_token: 'rt-mine', expires_in: 3600 });
		});
		const client = await service.refreshAccessToken(row as never);
		// The other pair may be half written: this call uses the access token its own exchange minted.
		expect(client?.usesToken('at-mine')).toBe(true);
		expect(value(JiraSettingName.ACCESS_TOKEN)).toBe('at-other');
		expect(value(JiraSettingName.REFRESH_TOKEN)).toBe('rt-other');
	});

	it('answers null when Atlassian refuses the refresh token (a person must connect again)', async () => {
		const { service, row, value } = harness({ [JiraSettingName.ACCESS_TOKEN]: 'at-1', [JiraSettingName.REFRESH_TOKEN]: 'rt-1', [JiraSettingName.EXPIRES_AT]: soon(), [JiraSettingName.JIRA_CLOUD_ID]: 'c' });
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(tokenAnswer({ error: 'invalid_grant', error_description: 'Unknown or invalid refresh token.' }, 403));
		expect(await service.refreshAccessToken(row as never)).toBeNull();
		expect(value(JiraSettingName.ACCESS_TOKEN)).toBe('at-1');
	});

	it('keeps the refresh token when a renewal answers none, and renews no connection without one', async () => {
		const { service, row, value } = harness({ [JiraSettingName.ACCESS_TOKEN]: 'at-1', [JiraSettingName.REFRESH_TOKEN]: 'rt-1', [JiraSettingName.EXPIRES_AT]: soon(), [JiraSettingName.JIRA_CLOUD_ID]: 'c' });
		jest.spyOn(globalThis, 'fetch').mockResolvedValue(tokenAnswer({ access_token: 'at-2', expires_in: 3600 }));
		await service.refreshAccessToken(row as never);
		expect(value(JiraSettingName.REFRESH_TOKEN)).toBe('rt-1');
		const none = harness({ [JiraSettingName.ACCESS_TOKEN]: 'at-1', [JiraSettingName.EXPIRES_AT]: soon(), [JiraSettingName.JIRA_CLOUD_ID]: 'c' });
		const fetch = jest.spyOn(globalThis, 'fetch');
		fetch.mockClear();
		expect((await none.service.clientReady(none.row as never)).cloudId).toBe('c');
		expect(fetch).not.toHaveBeenCalled();
	});

	it('records the site a person chose, and forgets the webhook of the former site', async () => {
		const { service, row, value } = harness({
			[JiraSettingName.ACCESS_TOKEN]: 'at',
			[JiraSettingName.JIRA_CLOUD_ID]: 'cloud-old',
			[JiraSettingName.WEBHOOK_IDS]: '1001',
			[JiraSettingName.WEBHOOK_JQL]: 'project in (1)'
		});
		await service.selectSite(row as never, { id: 'cloud-new', url: 'https://new.atlassian.net', name: 'New', scopes: [] }, { accountId: 'acc', displayName: 'Ada', emailAddress: null });
		expect(value(JiraSettingName.JIRA_CLOUD_ID)).toBe('cloud-new');
		expect(value(JiraSettingName.JIRA_SITE_URL)).toBe('https://new.atlassian.net');
		expect(value(JiraSettingName.JIRA_ACCOUNT_ID)).toBe('acc');
		expect(value(JiraSettingName.WEBHOOK_IDS)).toBe('');
		expect(service.webhookIdsOf(row as never)).toEqual([]);
		expect(service.summaryOf(row as never)).toMatchObject({ cloudId: 'cloud-new', siteName: 'New', accountName: 'Ada', siteRequired: false });
	});

	it('reads the webhook ids each once, digits only', () => {
		const { service, row } = harness({ [JiraSettingName.WEBHOOK_IDS]: '1001, 1002,1001,x' });
		expect(service.webhookIdsOf(row as never)).toEqual(['1001', '1002']);
	});
});
