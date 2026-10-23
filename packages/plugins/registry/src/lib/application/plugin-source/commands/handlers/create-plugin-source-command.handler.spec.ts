/**
 * `POST /plugins/:pluginId/versions/:versionId/sources` checked that the path's version is one of the caller's, then
 * saved `Object.assign(new PluginSource(), { versionId }, source)` through a raw repository: the body came last, and
 * its nested sources are not validated. An `id` from the body updated that source row in any tenant, and a
 * `versionId` / `tenantId` filed a new row under another tenant's plugin version - pointing that plugin's download,
 * which the desktop app installs, at the caller's own. The rows are now built by the server.
 */
const mockContext = { tenantId: 'tenant-a' as string | null };

jest.mock('@gauzy/core', () => ({ RequestContext: { currentTenantId: () => mockContext.tenantId } }));
jest.mock('../../../../domain', () => ({
	PluginSource: class PluginSource {},
	PluginSourceService: class PluginSourceService {},
	PluginVersionService: class PluginVersionService {}
}));
jest.mock('../../commands/create-plugin-source.command', () => ({
	CreatePluginSourceCommand: class CreatePluginSourceCommand {}
}));

import { NotFoundException } from '@nestjs/common';
import { ownedSourceRow } from '../../../../domain/services/plugin-source-rows';
import { CreatePluginSourceCommandHandler } from './create-plugin-source-command.handler';

describe('ownedSourceRow', () => {
	it('keeps the description of the source and sets the row identity and owner itself', () => {
		const row = ownedSourceRow(
			{
				id: 'source-of-tenant-b',
				versionId: 'version-of-tenant-b',
				tenantId: 'tenant-b',
				organizationId: 'organization-b',
				type: 'CDN',
				url: 'https://cdn.example.com/plugin.zip'
			},
			{ versionId: 'version-a', tenantId: 'tenant-a', organizationId: 'organization-a' }
		);

		expect(row).toEqual({
			id: undefined,
			versionId: 'version-a',
			tenantId: 'tenant-a',
			organizationId: 'organization-a',
			type: 'CDN',
			url: 'https://cdn.example.com/plugin.zip'
		});
	});

	it('leaves the version unset when the version is created after its sources', () => {
		expect(ownedSourceRow({ versionId: 'version-of-tenant-b' }, { tenantId: 'tenant-a' })).toEqual({
			id: undefined,
			versionId: undefined,
			tenantId: 'tenant-a',
			organizationId: undefined
		});
	});

	it('drops the version, tenant and organization relations the request names, which TypeORM would write instead', () => {
		const row = ownedSourceRow(
			{
				version: { id: 'version-of-tenant-b' },
				tenant: { id: 'tenant-b' },
				organization: { id: 'organization-b' },
				type: 'CDN'
			},
			{ versionId: 'version-a', tenantId: 'tenant-a', organizationId: 'organization-a' }
		);

		expect(row.version).toBeUndefined();
		expect(row.tenant).toBeUndefined();
		expect(row.organization).toBeUndefined();
		expect(row).toEqual({
			versionId: 'version-a',
			tenantId: 'tenant-a',
			organizationId: 'organization-a',
			type: 'CDN'
		});
	});
});

describe('CreatePluginSourceCommandHandler', () => {
	const build = (version: Record<string, unknown> | null) => {
		const pluginVersionService = {
			findOneOrFailByWhereOptions: jest.fn(async () =>
				version ? { success: true, record: version } : { success: false }
			)
		};
		const pluginSourceService = { saveSources: jest.fn(async (rows: unknown[]) => rows) };
		const handler = new CreatePluginSourceCommandHandler(pluginVersionService as any, pluginSourceService as any);
		return { handler, pluginVersionService, pluginSourceService };
	};
	const command = (input: Record<string, unknown>[]) =>
		({ pluginId: 'plugin-a', versionId: 'version-a', input }) as any;

	beforeEach(() => {
		mockContext.tenantId = 'tenant-a';
	});

	it("files every source as a new row of the path's version, in that version's tenant", async () => {
		const { handler, pluginVersionService, pluginSourceService } = build({
			id: 'version-a',
			tenantId: 'tenant-a',
			organizationId: 'organization-a'
		});

		await handler.execute(
			command([
				{
					id: 'source-of-tenant-b',
					versionId: 'version-of-tenant-b',
					tenantId: 'tenant-b',
					organizationId: 'organization-b',
					type: 'CDN',
					url: 'https://attacker.example/payload.zip'
				}
			])
		);

		expect(pluginVersionService.findOneOrFailByWhereOptions).toHaveBeenCalledWith({
			id: 'version-a',
			pluginId: 'plugin-a'
		});
		const [rows] = pluginSourceService.saveSources.mock.calls[0];
		expect(rows).toEqual([
			expect.objectContaining({
				id: undefined,
				versionId: 'version-a',
				tenantId: 'tenant-a',
				organizationId: 'organization-a',
				url: 'https://attacker.example/payload.zip'
			})
		]);
	});

	it("falls back to the caller's tenant for a version row without one", async () => {
		const { handler, pluginSourceService } = build({ id: 'version-a' });

		await handler.execute(command([{ tenantId: 'tenant-b', type: 'NPM', name: '@scope/plugin' }]));

		const [rows] = pluginSourceService.saveSources.mock.calls[0];
		expect(rows[0]).toEqual(expect.objectContaining({ tenantId: 'tenant-a', versionId: 'version-a' }));
	});

	it('saves nothing for a version that is not one of the plugin', async () => {
		const { handler, pluginSourceService } = build(null);

		await expect(handler.execute(command([{ type: 'CDN' }]))).rejects.toBeInstanceOf(NotFoundException);
		expect(pluginSourceService.saveSources).not.toHaveBeenCalled();
	});
});
