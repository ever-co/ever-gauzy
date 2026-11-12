jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));
jest.mock('./jira-tenant.service', () => ({ JiraTenantService: class JiraTenantService {} }));
jest.mock('./jira-mapping.service', () => ({ JiraMappingService: class JiraMappingService {} }));
jest.mock('./jira-oauth-state.service', () => ({ JiraOAuthStateService: class JiraOAuthStateService {} }));
jest.mock('./jira-process', () => ({ jiraSyncUser: () => ({}), runInJiraContext: (_user: unknown, work: () => unknown) => work() }));
jest.mock('./client/jira-api.client', () => {
	class JiraApiClient {
		constructor(
			readonly token: string,
			readonly cloudId: string
		) {}
		async myself() {
			return { accountId: `me@${this.cloudId}`, displayName: 'Ada', emailAddress: null };
		}
	}
	return { JiraApiClient, accessibleJiraSites: jest.fn(), exchangeJiraCode: jest.fn() };
});

import { Logger } from '@nestjs/common';
import { accessibleJiraSites, exchangeJiraCode } from './client/jira-api.client';
import { JiraAuthorizationController } from './jira-authorization.controller';
import { JiraCloudConfig } from './jira-config';

const config = {
	clientId: 'client-id',
	clientSecret: 'client-secret',
	redirectUrl: 'https://api.example.test/api/integration/jira/callback',
	postInstallUrl: 'https://app.example.test/#/pages/integrations/jira',
	apiUrl: 'https://gateway.test'
} as JiraCloudConfig;

const SITE_A = { id: 'cloud-a', name: 'A', url: 'https://a.atlassian.net', scopes: ['read:jira-work'] };
const SITE_B = { id: 'cloud-b', name: 'B', url: 'https://b.atlassian.net', scopes: ['read:jira-work'] };
const SCOPE = { tenantId: 'tenant-1', organizationId: 'org-1', userId: 'user-1' };

/** The callback over an organization whose connection (if any) works with `existingSite` and has `mappings` mappings. */
function setup(options: { sites: (typeof SITE_A)[]; existingSite: string | null; mappings: number; synced?: boolean; postInstallUrl?: string; refreshToken?: string | null }) {
	const existing = { id: 'int-1' };
	const tenants = {
		forOrganization: jest.fn(async () => existing),
		summaryOf: jest.fn(() => ({ cloudId: options.existingSite })),
		connect: jest.fn(async () => ({ id: 'int-1' }))
	};
	const mappings = {
		list: jest.fn(async () => Array.from({ length: options.mappings }, (_, index) => ({ id: `m-${index}` }))),
		hasIssueMaps: jest.fn(async () => !!options.synced),
		hasLiveRuns: jest.fn(async () => false),
		// The reconnect is written under the organization's mappings lock.
		whileOrganizationMappingsLocked: jest.fn(async (_scope: unknown, work: () => Promise<unknown>) => work())
	};
	const oauthState = { consume: jest.fn(async () => SCOPE) };
	(exchangeJiraCode as jest.Mock).mockResolvedValue({ accessToken: 'at', refreshToken: options.refreshToken === undefined ? 'rt' : options.refreshToken, tokenType: 'Bearer' });
	(accessibleJiraSites as jest.Mock).mockResolvedValue(options.sites);
	const controller = new JiraAuthorizationController({ ...config, ...(options.postInstallUrl ? { postInstallUrl: options.postInstallUrl } : {}) }, oauthState as never, tenants as never, mappings as never);
	const response: { redirect: jest.Mock; status: jest.Mock; json: jest.Mock } = { redirect: jest.fn(), status: jest.fn(), json: jest.fn() };
	response.status.mockReturnValue(response);
	const callback = () => controller.callback({ state: 'state-1', code: 'code-1' }, response as never);
	const sentTo = () => new URL(String(response.redirect.mock.calls[0]?.[0]).replace('#/', ''));
	return { tenants, mappings, callback, sentTo, response };
}

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('GET /integration/jira/callback: the site of the connection', () => {
	it('a first connect whose token reaches one site uses it at once', async () => {
		const { tenants, callback, sentTo } = setup({ sites: [SITE_A], existingSite: null, mappings: 0 });
		await callback();
		expect(tenants.connect).toHaveBeenCalledWith(SCOPE, expect.anything(), { site: SITE_A, myself: expect.objectContaining({ accountId: 'me@cloud-a' }) });
		expect(sentTo().searchParams.get('integrationId')).toBe('int-1');
		expect(sentTo().searchParams.has('siteRequired')).toBe(false);
	});

	it('a first connect whose token reaches several sites waits for a person to choose one', async () => {
		const { tenants, callback, sentTo } = setup({ sites: [SITE_A, SITE_B], existingSite: null, mappings: 0 });
		await callback();
		expect(tenants.connect).toHaveBeenCalledWith(SCOPE, expect.anything(), null);
		expect(sentTo().searchParams.get('siteRequired')).toBe('true');
	});

	it('a reconnect of a connection with mappings keeps its site, even when the token reaches several', async () => {
		const { tenants, callback, sentTo } = setup({ sites: [SITE_A, SITE_B], existingSite: SITE_B.id, mappings: 2 });
		await callback();
		expect(tenants.connect).toHaveBeenCalledWith(SCOPE, expect.anything(), { site: SITE_B, myself: expect.objectContaining({ accountId: 'me@cloud-b' }) });
		expect(sentTo().searchParams.has('siteRequired')).toBe(false);
	});

	it('a reconnect of a connection with mappings whose token no longer reaches its site is refused (site_mismatch), nothing saved', async () => {
		const { tenants, callback, sentTo } = setup({ sites: [SITE_A], existingSite: SITE_B.id, mappings: 1 });
		await callback();
		expect(tenants.connect).not.toHaveBeenCalled();
		expect(sentTo().searchParams.get('error')).toBe('site_mismatch');
	});

	it('refuses a reconnect to another site when a mapping of the former site appeared while it ran (read again under the lock)', async () => {
		const { tenants, mappings, callback, sentTo } = setup({ sites: [SITE_A], existingSite: SITE_B.id, mappings: 0 });
		// No mapping when the callback first looks; one by the time it holds the lock.
		mappings.list.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'm-new' }]);
		await callback();
		expect(mappings.whileOrganizationMappingsLocked).toHaveBeenCalledTimes(1);
		expect(tenants.connect).not.toHaveBeenCalled();
		expect(sentTo().searchParams.get('error')).toBe('site_mismatch');
	});

	it('saves no grant without a refresh token (offline_access not granted): it would stop working within the hour', async () => {
		const { tenants, callback, sentTo } = setup({ sites: [SITE_A], existingSite: null, mappings: 0, refreshToken: null });
		await callback();
		expect(tenants.connect).not.toHaveBeenCalled();
		expect(sentTo().searchParams.get('error')).toBe('exchange_failed');
	});

	it('adds its result to a page route that carries a query of its own', async () => {
		const { callback, response } = setup({ sites: [SITE_A], existingSite: null, mappings: 0, postInstallUrl: 'https://app.example.test/#/pages/integrations/jira?mode=setup' });
		await callback();
		expect(String(response.redirect.mock.calls[0][0])).toBe('https://app.example.test/#/pages/integrations/jira?mode=setup&provider=jira&integrationId=int-1&organizationId=org-1');
	});

	it('a reconnect of a connection whose mappings are gone but whose synced issues name its site keeps that site', async () => {
		const { tenants, callback, sentTo } = setup({ sites: [SITE_A], existingSite: SITE_B.id, mappings: 0, synced: true });
		await callback();
		expect(tenants.connect).not.toHaveBeenCalled();
		expect(sentTo().searchParams.get('error')).toBe('site_mismatch');
	});

	it('a reconnect keeps the site while a run of the former site is still live, though its mapping is gone', async () => {
		const { tenants, mappings, callback, sentTo } = setup({ sites: [SITE_A], existingSite: SITE_B.id, mappings: 0 });
		mappings.hasLiveRuns.mockResolvedValue(true);
		await callback();
		expect(tenants.connect).not.toHaveBeenCalled();
		expect(sentTo().searchParams.get('error')).toBe('site_mismatch');
	});

	it('a reconnect of a connection without mappings may move to the only site the token reaches', async () => {
		const { tenants, mappings, callback } = setup({ sites: [SITE_A], existingSite: SITE_B.id, mappings: 0 });
		await callback();
		expect(mappings.list).toHaveBeenCalled();
		expect(tenants.connect).toHaveBeenCalledWith(SCOPE, expect.anything(), { site: SITE_A, myself: expect.anything() });
	});
});
