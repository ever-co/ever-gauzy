import { RequestContext } from '@gauzy/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';

import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { PluginSubscriptionPlanService } from '../../../domain/services/plugin-subscription-plan.service';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { PluginService } from '../../../domain/services/plugin.service';
import { IPlugin } from '../../../shared/models/plugin.model';
import { CreatePluginSubscriptionPlanCommand } from '../../commands/create-plugin-subscription-plan.command';
import { UpdatePluginSubscriptionPlanCommand } from '../../commands/update-plugin-subscription-plan.command';
import { UpdatePluginCommand } from '../../commands/update-plugin.command';

@CommandHandler(UpdatePluginCommand)
export class UpdatePluginCommandHandler implements ICommandHandler<UpdatePluginCommand> {
	constructor(
		private readonly versionService: PluginVersionService,
		private readonly sourceService: PluginSourceService,
		private readonly pluginService: PluginService,
		private readonly pluginSubscriptionPlanService: PluginSubscriptionPlanService,
		private readonly dataSource: DataSource,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * Updates a plugin and its associated source and version
	 *
	 * @param command - The update plugin command with input data and plugin ID
	 * @returns The updated plugin
	 * @throws NotFoundException if plugin, source, or version is not found
	 * @throws BadRequestException if plugin ID is missing or update fails
	 */
	public async execute(command: UpdatePluginCommand): Promise<IPlugin> {
		const { input, id } = command;

		if (!id) {
			throw new BadRequestException('Plugin ID is required');
		}

		// Start a transaction for updating the plugin and related entities
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// Validate plugin exists - throws NotFoundException if not found
			const existingPlugin = await this.pluginService.findOneOrFailByIdString(id);
			if (!existingPlugin.success) {
				throw new NotFoundException(`Plugin with ID "${id}" not found`);
			}

			// Update version and sources if provided
			if (input.version) {
				await this.versionService.updateVersion(input.version, id);

				// Update sources in parallel if they exist
				if (input.version.sources?.length > 0) {
					await Promise.all(
						input.version.sources.map((source) => this.sourceService.updateSource(source, input.version.id))
					);
				}
			}

			// Update plugin with only provided fields
			const pluginUpdate: Partial<IPlugin> = {
				name: input.name,
				type: input.type,
				status: input.status,
				description: input.description,
				isActive: input.isActive,
				repository: input.repository,
				author: input.author,
				license: input.license,
				homepage: input.homepage,
				requiresSubscription: input.requiresSubscription
			};
			await this.pluginService.update(id, pluginUpdate);

			// Handle subscription plans if provided
			if (input.subscriptionPlans?.length > 0) {
				const tenantId = RequestContext.currentTenantId();
				const organizationId = RequestContext.currentOrganizationId();
				const userId = RequestContext.currentUser()?.id;

				await Promise.all(
					input.subscriptionPlans.map((planData) => {
						// Update existing plan if it has an ID, otherwise create new
						if (planData.id) {
							return this.commandBus.execute(
								new UpdatePluginSubscriptionPlanCommand(planData.id, planData)
							);
						} else {
							return this.commandBus.execute(
								new CreatePluginSubscriptionPlanCommand(
									{ ...planData, pluginId: id },
									tenantId,
									organizationId,
									userId
								)
							);
						}
					})
				);
			}

			await queryRunner.commitTransaction();

			// Return the updated plugin with relations
			return await this.pluginService.findOneByIdString(id, {
				relations: ['versions', 'versions.sources']
			});
		} catch (error) {
			// Roll back transaction on error
			await queryRunner.rollbackTransaction();

			// Re-throw known exceptions
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}

			// Wrap unknown errors
			throw new BadRequestException(`Failed to update plugin: ${error.message}`);
		} finally {
			// Release resources
			await queryRunner.release();
		}
	}
}
