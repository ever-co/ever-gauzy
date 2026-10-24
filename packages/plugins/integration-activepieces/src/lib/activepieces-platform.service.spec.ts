/**
 * The operator gives an existing Activepieces project to a tenant by writing the tenant's external id on it.
 * Activepieces has no conditional update, so two requests giving the same project to two tenants must not both
 * succeed, and a project already carrying another tenant's external id is never taken over.
 */
jest.mock('@gauzy/core', () => ({
	RequestContext: { currentTenantId: () => 'operator-tenant' },
	IntegrationService: class {},
	IntegrationSettingService: class {},
	IntegrationTenantService: class {},
	TenantOrganizationBaseDTO: class {}
}));
jest.mock('@gauzy/config', () => ({ ConfigService: class {} }));

import { ConflictException, Logger } from '@nestjs/common';
import { ACTIVEPIECES_PROJECTS_URL } from './activepieces.config';
import { ACTIVEPIECES_PROJECT_ALREADY_LINKED, ActivepiecesPlatformService } from './activepieces-platform.service';

const PROJECT_URL = `${ACTIVEPIECES_PROJECTS_URL}/proj-1`;

/**
 * A fake of the credentials service over one Activepieces project whose external id the requests read and write.
 * `afterWrite` lets a test change the project after a write lands, as another API server would.
 */
function setup(project: { id: string; externalId: string | null }, afterWrite?: (written: string) => void) {
	const credentials = {
		operatorSettings: () => ({ platformApiKey: 'platform-key', externalIdPrefix: 'gauzy-tenant-' }),
		tenantExternalId: (tenantId: string) => `gauzy-tenant-${tenantId}`,
		findProjectByExternalId: jest.fn(async (externalId: string) =>
			project.externalId === externalId ? { ...project } : null
		),
		requestActivepieces: jest.fn(async (method: string, url: string, _key: string, _action: string, options: any) => {
			// Each call yields, as an HTTP call would, so concurrent requests interleave
			await new Promise((resolve) => setImmediate(resolve));
			expect(url).toBe(PROJECT_URL);
			if (method === 'post') {
				project.externalId = options.data.externalId;
				afterWrite?.(options.data.externalId);
			}
			return { ...project };
		}),
		forgetTenant: jest.fn()
	};
	const service = new ActivepiecesPlatformService(credentials as any);
	return { service, credentials, project };
}

async function refusal(promise: Promise<unknown>): Promise<ConflictException> {
	const error = await promise.then(
		() => undefined,
		(reason) => reason
	);
	expect(error).toBeInstanceOf(ConflictException);
	return error as ConflictException;
}

describe('ActivepiecesPlatformService — giving a project to a tenant', () => {
	beforeAll(() => Logger.overrideLogger(false));

	it('gives an unassigned project, and confirms Activepieces kept the external id', async () => {
		const { service, credentials, project } = setup({ id: 'proj-1', externalId: null });

		await expect(service.connectTenantProject('tenant-a', { projectId: 'proj-1' })).resolves.toEqual({
			tenantId: 'tenant-a',
			externalId: 'gauzy-tenant-tenant-a',
			projectId: 'proj-1',
			linked: true
		});
		expect(project.externalId).toBe('gauzy-tenant-tenant-a');
		expect(credentials.requestActivepieces.mock.calls.map(([method]) => method)).toEqual(['get', 'post', 'get']);
		expect(credentials.forgetTenant).toHaveBeenCalledWith('tenant-a');
	});

	it("refuses up front a project that carries another tenant's external id", async () => {
		const { service, credentials, project } = setup({ id: 'proj-1', externalId: 'gauzy-tenant-tenant-b' });

		const error = await refusal(service.connectTenantProject('tenant-a', { projectId: 'proj-1' }));

		expect(error.getResponse()).toEqual(expect.objectContaining({ code: ACTIVEPIECES_PROJECT_ALREADY_LINKED }));
		expect(credentials.requestActivepieces.mock.calls.map(([method]) => method)).toEqual(['get']);
		expect(project.externalId).toBe('gauzy-tenant-tenant-b');
	});

	it('links nothing when another server gave the project to another tenant between the write and the re-read', async () => {
		const { service, credentials, project } = setup({ id: 'proj-1', externalId: null }, () => {
			// The other server's write lands right after this one: Activepieces keeps the other tenant's
			project.externalId = 'gauzy-tenant-tenant-b';
		});

		const error = await refusal(service.connectTenantProject('tenant-a', { projectId: 'proj-1' }));

		expect(error.getResponse()).toEqual(expect.objectContaining({ code: ACTIVEPIECES_PROJECT_ALREADY_LINKED }));
		expect(credentials.forgetTenant).not.toHaveBeenCalled();
		// The other tenant's external id, which won, is left as it is
		expect(project.externalId).toBe('gauzy-tenant-tenant-b');
	});

	it('gives the project to one tenant only when two requests on this server race for it', async () => {
		const { service, credentials, project } = setup({ id: 'proj-1', externalId: null });

		const [first, second] = await Promise.allSettled([
			service.connectTenantProject('tenant-a', { projectId: 'proj-1' }),
			service.connectTenantProject('tenant-b', { projectId: 'proj-1' })
		]);

		expect(first.status).toBe('fulfilled');
		expect(second.status).toBe('rejected');
		expect((second as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
		expect(project.externalId).toBe('gauzy-tenant-tenant-a');
		expect(credentials.requestActivepieces.mock.calls.filter(([method]) => method === 'post')).toHaveLength(1);
	});
});
