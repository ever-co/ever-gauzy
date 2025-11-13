import { IPlugin } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { PluginService, PluginSourceService, PluginVersionService } from '../../../../domain';
import { CreatePluginSubscriptionPlanCommand } from '../../../plugin-subscription';
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

		// Validate input
		if (
			!input ||
			!input.version ||
			(input.version.sources && input.version.sources.length === 0 && !input.version)
		) {
			throw new BadRequestException('Invalid plugin data: Source requires version information');
		}

		// Use a transaction to ensure data consistency
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Create the plugin
			const plugin = Object.assign(new Plugin(), input);
			// Check if has plans
			const requiresSubscription = input.subscriptionPlans && input.subscriptionPlans.length > 0;
			// Requires subscription if plans are provided
			plugin.requiresSubscription = requiresSubscription;
			// Save the plugin
			const savedPlugin = await this.pluginService.save(plugin);

			// Process source and version if provided
			if (input.version.sources.length > 0) {
				const savedSource = await this.sourceService.createSources(input.version.sources);
				await this.versionService.createVersion(input.version, savedPlugin, savedSource);
			}

			// Create subscription plans if provided
			if (requiresSubscription) {
				const tenantId = RequestContext.currentTenantId();
				const organizationId = RequestContext.currentOrganizationId();
				const user = RequestContext.currentUser();

				for (const planData of input.subscriptionPlans) {
					const planWithPluginId = {
						...planData,
						pluginId: savedPlugin.id
					};

					await this.commandBus.execute(
						new CreatePluginSubscriptionPlanCommand(planWithPluginId, tenantId, organizationId, user?.id)
					);
				}
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
