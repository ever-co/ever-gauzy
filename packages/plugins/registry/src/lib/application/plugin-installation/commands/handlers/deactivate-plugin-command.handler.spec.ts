// `@gauzy/core` and the domain drag in the entity graph; the handler only reads the caller from the request context.
jest.mock('@gauzy/core', () => ({
	RequestContext: { currentUser: () => ({ id: 'user-a', employeeId: 'employee-a' }) }
}));
jest.mock('../../../../domain', () => ({ PluginInstallationService: class PluginInstallationService {} }));

import { PluginInstallationStatus } from '@gauzy/contracts';
import { ForbiddenException } from '@nestjs/common';
import { DeactivatePluginCommand } from '../deactivate-plugin.command';
import { DeactivatePluginCommandHandler } from './deactivate-plugin-command.handler';

/**
 * `PATCH /plugins/:pluginId/installations/:installationId { "status": "inactive" }` read the installation by its id
 * alone, so any member with access to a plugin could switch a colleague's installation off. Activating already
 * required the caller's own installation of the plugin of the path; deactivating now does too.
 */
describe('DeactivatePluginCommandHandler', () => {
	const INSTALLED = { id: 'installation-1', status: PluginInstallationStatus.INSTALLED, isActivated: true };

	it('reads the caller’s own installation of the plugin of the path', async () => {
		const service = {
			findOneOrFailByWhereOptions: jest.fn(async () => ({ success: true, record: INSTALLED })),
			update: jest.fn()
		};

		await new DeactivatePluginCommandHandler(service as any).execute(
			new DeactivatePluginCommand('plugin-1', 'installation-1')
		);

		expect(service.findOneOrFailByWhereOptions).toHaveBeenCalledWith({
			id: 'installation-1',
			installedById: 'employee-a',
			pluginId: 'plugin-1'
		});
		expect(service.update).toHaveBeenCalledWith('installation-1', expect.objectContaining({ isActivated: false }));
	});

	it('refuses a colleague’s installation, and writes nothing', async () => {
		const service = {
			findOneOrFailByWhereOptions: jest.fn(async () => ({ success: false })),
			update: jest.fn()
		};

		await expect(
			new DeactivatePluginCommandHandler(service as any).execute(
				new DeactivatePluginCommand('plugin-1', 'colleague-installation')
			)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(service.update).not.toHaveBeenCalled();
	});
});
