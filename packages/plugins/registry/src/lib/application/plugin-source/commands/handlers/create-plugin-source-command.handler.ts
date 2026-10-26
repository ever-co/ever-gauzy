import { IPluginSource } from '@gauzy/contracts';
import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from '@gauzy/core';
import { PluginSource, PluginSourceService, PluginVersionService } from '../../../../domain';
import { ownedSourceRow } from '../../../../domain/services/plugin-source-rows';
import { CreatePluginSourceCommand } from '../../commands/create-plugin-source.command';

@CommandHandler(CreatePluginSourceCommand)
export class CreatePluginSourceCommandHandler implements ICommandHandler<CreatePluginSourceCommand> {
	constructor(
		private readonly pluginVersionService: PluginVersionService,
		private readonly pluginSourceService: PluginSourceService
	) {}

	/**
	 * Handles the execution of the CreatePluginVersionCommand.
	 *
	 * @param {CreatePluginSourceCommand} command - The command instance containing plugin ID and DTO.
	 * @returns {Promise<IPluginSource[]>} - The created plugin source.
	 * @throws {NotFoundException} - If the plugin with the given ID does not exist.
	 */
	public async execute(command: CreatePluginSourceCommand): Promise<IPluginSource[]> {
		const { pluginId, versionId, input } = command;

		// Fetch plugin by ID
		const validation = await this.pluginVersionService.findOneOrFailByWhereOptions({
			id: versionId,
			pluginId
		});
		if (!validation.success) {
			throw new NotFoundException(`Plugin source with ID ${versionId} not found.`);
		}

		// New rows of this version, in its tenant: the request describes a source, it does not choose the row (an id or
		// a version from the body used to update or file a row of another tenant's plugin)
		const version = validation.record;
		const owner = {
			versionId,
			tenantId: version?.tenantId ?? RequestContext.currentTenantId(),
			organizationId: version?.organizationId
		};
		const sources = input.map((source) => Object.assign(new PluginSource(), ownedSourceRow(source, owner)));

		// Save the plugin source
		return this.pluginSourceService.saveSources(sources);
	}
}
