import { IPlugin } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { Plugin, PluginService, PluginSourceService, PluginVersionService } from '../../../../domain';
import { BulkCreatePluginPlansCommand } from '../../../plugin-subscription';
import { CreatePluginCommand } from '../create-plugin.command';

@CommandHandler(CreatePluginCommand)
export class CreatePluginCommandHandler implements ICommandHandler<CreatePluginCommand> {
	constructor(
		private readonly versionService: PluginVersionService,
		private readonly sourceService: PluginSourceService,
		private readonly pluginService: PluginService,
		private readonly dataSource: DataSource,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * Executes the create plugin command
	 *
	 * @param command - The command containing plugin creation data
	 * @returns The created plugin
	 * @throws BadRequestException if validation fails
	 */
	public async execute(command: CreatePluginCommand): Promise<IPlugin> {
		const { input } = command;

		if (!input || !input.version || (Array.isArray(input.version.sources) && input.version.sources.length === 0)) {
			throw new BadRequestException('Invalid plugin data: Source requires version information');
		}

		const { subscriptionPlans = [], ...pluginInput } = input;

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Create the plugin (subscriptionPlans are handled separately below)
			const plugin = Plugin.create(pluginInput);
			// Check if has plans
			const requiresSubscription = subscriptionPlans && subscriptionPlans.length > 0;
			// Requires subscription if plans are provided
			plugin.requiresSubscription = requiresSubscription;
			// Save the plugin
			const savedPlugin = await this.pluginService.save(plugin);

			// Process source and version if provided
			if (pluginInput.version.sources.length > 0) {
				const savedSource = await this.sourceService.createSources(pluginInput.version.sources);
				await this.versionService.createVersion(pluginInput.version, savedPlugin, savedSource);
			}

			// Create subscription plans if provided
			if (requiresSubscription) {
				const tenantId = RequestContext.currentTenantId();
				const organizationId = RequestContext.currentOrganizationId();
				const user = RequestContext.currentUser();

				// Attach plugin ID to all plans
				const plansWithPluginId = subscriptionPlans.map((planData) => ({
					...planData,
					pluginId: savedPlugin.id
				}));

				// Create all plans at once using bulk create command
				await this.commandBus.execute(
					new BulkCreatePluginPlansCommand(plansWithPluginId, tenantId, organizationId, user?.id)
				);
			}

			await queryRunner.commitTransaction();

			// Return the complete plugin with all relations
			const result = await this.pluginService.findOneByIdString(savedPlugin.id, {
				relations: ['versions', 'versions.sources']
			});
			return result as IPlugin;
		} catch (error) {
			// Rollback transaction on error
			await queryRunner.rollbackTransaction();
			throw new BadRequestException(`Failed to create plugin: ${error.message}`);
		} finally {
			// Release queryRunner resources
			await queryRunner.release();
		}
	}
}
