jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	class Guard {
		canActivate() {
			return true;
		}
	}
	return {
		TenantOrganizationBaseDTO: class TenantOrganizationBaseDTO {},
		PermissionGuard: Guard,
		TenantPermissionGuard: Guard,
		Permissions: decorator,
		UseValidationPipe: decorator,
		UUIDValidationPipe: class UUIDValidationPipe {},
		RequestContext: { currentTenantId: () => null, currentUserId: () => null }
	};
});
jest.mock('./entities/jira-project-mapping.entity', () => ({ JiraSyncDirection: { INBOUND: 'inbound', OUTBOUND: 'outbound', BOTH: 'both' } }));
jest.mock('./entities/jira-sync-conflict.entity', () => ({ JiraSyncConflictStatus: { OPEN: 'open', RESOLVED: 'resolved' } }));
jest.mock('./entities/jira-sync-run.entity', () => ({}));
jest.mock('./jira-tenant.service', () => ({ JiraTenantService: class JiraTenantService {} }));
jest.mock('./jira-mapping.service', () => ({ JiraMappingService: class JiraMappingService {} }));
jest.mock('./jira-sync-run.service', () => ({ JiraSyncRunService: class JiraSyncRunService {}, parseRunReport: () => null }));
jest.mock('./jira-sync-conflict.service', () => ({ JiraSyncConflictService: class JiraSyncConflictService {} }));
jest.mock('./jira-oauth-state.service', () => ({ JiraOAuthStateService: class JiraOAuthStateService {} }));
jest.mock('./sync/jira-sync.service', () => ({ JiraSyncService: class JiraSyncService {} }));
jest.mock('./sync/jira-webhook.service', () => ({ JiraWebhookService: class JiraWebhookService {} }));
jest.mock('./sync/jira-issue.mapper', () => ({ DEFAULT_STATUS_MAP: {}, parseIssueTypeIds: () => [], parseStatusMap: () => ({}) }));
jest.mock('./client/jira-api.client', () => ({ accessibleJiraSites: jest.fn() }));

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { accessibleJiraSites } from './client/jira-api.client';
import { JiraCloudController } from './jira-cloud.controller';
import { JiraCloudConfig } from './jira-config';
import { JIRA_SITE_HAS_MAPPINGS, JIRA_SITE_NOT_FOUND } from './jira.constants';

const SITE_A = { id: 'cloud-a', name: 'Site A', url: 'https://a.atlassian.net', scopes: ['read:jira-work'] };
const SITE_B = { id: 'cloud-b', name: 'Site B', url: 'https://b.atlassian.net', scopes: ['read:jira-work'] };

function setup(options: { current: string | null; mappings: number; synced?: boolean }) {
	const tenant = { id: 'integration-1', tenantId: 'tenant-1', organizationId: 'org-1' };
	const tenants = {
		requireById: jest.fn(async () => tenant),
		findAnyById: jest.fn(async () => tenant),
		clientFor: jest.fn(() => {
			if (!options.current) throw new BadRequestException({ message: 'Choose a site first', code: 'JIRA_SITE_REQUIRED' });
			return {};
		}),
		accessTokenReady: jest.fn(async () => 'access-token'),
		summaryOf: jest.fn(() => ({ id: tenant.id, cloudId: options.current })),
		clientForSite: jest.fn(() => ({ myself: jest.fn(async () => ({ accountId: 'me' })) })),
		selectSite: jest.fn(async () => tenant)
	};
	// The site is checked and written under the mappings' lock, which hands over how many the connection has.
	const mappings = {
		whileMappingsLocked: jest.fn(async (_tenant: unknown, work: (count: number, synced: boolean) => Promise<unknown>) => work(options.mappings, !!options.synced)),
		createMapping: jest.fn(async () => ({ id: 'mapping-new', statusMap: null, issueTypeIds: null }))
	};
	const webhooks = { remove: jest.fn(async () => undefined), ensure: jest.fn(async () => 'registered') };
	const config = { apiUrl: 'https://api.example.test' } as JiraCloudConfig;
	const controller = new JiraCloudController(config, tenants as never, mappings as never, {} as never, {} as never, webhooks as never, {} as never, {} as never);
	// The webhook of the new site is registered behind the answer; not this spec's subject.
	(controller as unknown as { ensureWebhookLater: (tenant: unknown) => void }).ensureWebhookLater = () => undefined;
	(accessibleJiraSites as jest.Mock).mockResolvedValue([SITE_A, SITE_B]);
	return { controller, tenants, mappings, webhooks };
}

describe('PUT /integration/jira/:integrationId/site', () => {
	it('chooses the first site of a connection that has none, under the mappings lock', async () => {
		const { controller, tenants, mappings, webhooks } = setup({ current: null, mappings: 0 });
		await controller.selectSite('integration-1' as never, { cloudId: SITE_B.id } as never);
		expect(mappings.whileMappingsLocked).toHaveBeenCalledTimes(1);
		expect(webhooks.remove).not.toHaveBeenCalled();
		expect(tenants.selectSite).toHaveBeenCalledWith(expect.anything(), SITE_B, { accountId: 'me' });
	});

	it('moves a connection without mappings to another site, and removes the former site webhook', async () => {
		const { controller, tenants, webhooks } = setup({ current: SITE_A.id, mappings: 0 });
		await controller.selectSite('integration-1' as never, { cloudId: SITE_B.id } as never);
		expect(webhooks.remove).toHaveBeenCalledTimes(1);
		expect(tenants.selectSite).toHaveBeenCalledWith(expect.anything(), SITE_B, { accountId: 'me' });
	});

	it('refuses (409) to move a connection that has mappings: their project ids are only unique on the former site', async () => {
		const { controller, tenants, webhooks } = setup({ current: SITE_A.id, mappings: 2 });
		const answer = controller.selectSite('integration-1' as never, { cloudId: SITE_B.id } as never);
		await expect(answer).rejects.toBeInstanceOf(ConflictException);
		await expect(answer).rejects.toMatchObject({ response: { code: JIRA_SITE_HAS_MAPPINGS } });
		expect(webhooks.remove).not.toHaveBeenCalled();
		expect(tenants.selectSite).not.toHaveBeenCalled();
	});

	it('refuses a site to a connection that has mappings but no site (never the case once a site was chosen)', async () => {
		const { controller, tenants } = setup({ current: null, mappings: 1 });
		await expect(controller.selectSite('integration-1' as never, { cloudId: SITE_B.id } as never)).rejects.toBeInstanceOf(ConflictException);
		expect(tenants.selectSite).not.toHaveBeenCalled();
	});

	it('refuses (409) to move a connection whose mappings are gone but whose synced issues name the former site', async () => {
		const { controller, tenants, webhooks } = setup({ current: SITE_A.id, mappings: 0, synced: true });
		const answer = controller.selectSite('integration-1' as never, { cloudId: SITE_B.id } as never);
		await expect(answer).rejects.toMatchObject({ response: { code: JIRA_SITE_HAS_MAPPINGS } });
		expect(webhooks.remove).not.toHaveBeenCalled();
		expect(tenants.selectSite).not.toHaveBeenCalled();
	});

	it('lets a connection with mappings choose its own site again', async () => {
		const { controller, tenants, webhooks } = setup({ current: SITE_A.id, mappings: 2 });
		await controller.selectSite('integration-1' as never, { cloudId: SITE_A.id } as never);
		expect(webhooks.remove).not.toHaveBeenCalled();
		expect(tenants.selectSite).toHaveBeenCalledWith(expect.anything(), SITE_A, { accountId: 'me' });
	});

	it('answers 404 for a site the token does not reach', async () => {
		const { controller } = setup({ current: null, mappings: 0 });
		const answer = controller.selectSite('integration-1' as never, { cloudId: 'cloud-z' } as never);
		await expect(answer).rejects.toBeInstanceOf(NotFoundException);
		await expect(answer).rejects.toMatchObject({ response: { code: JIRA_SITE_NOT_FOUND } });
	});
});

describe('POST /integration/jira/:integrationId/mappings', () => {
	it('refuses a mapping before a site is chosen: its Jira project id would mean nothing', async () => {
		const { controller, mappings } = setup({ current: null, mappings: 0 });
		await expect(controller.createMapping('integration-1' as never, { jiraProjectId: '10000', projectId: 'p-1' } as never)).rejects.toBeInstanceOf(BadRequestException);
		expect(mappings.createMapping).not.toHaveBeenCalled();
	});

	it('creates it pinned to the site the request read (the lock refuses it if the site changed meanwhile)', async () => {
		const { controller, mappings } = setup({ current: SITE_A.id, mappings: 0 });
		await controller.createMapping('integration-1' as never, { jiraProjectId: '10000', projectId: 'p-1' } as never);
		expect(mappings.createMapping).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ jiraProjectId: '10000' }), SITE_A.id);
	});
});
