import { RequestContext } from '@gauzy/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { PluginService, PluginSourceService, PluginVersionService } from '../../../../domain';
import { IPlugin } from '../../../../shared';
import { SubscriptionPlanOperationFactory } from '../../../strategies';
import { UpdatePluginCommand } from '../update-plugin.command';

@CommandHandler(UpdatePluginCommand)
export class UpdatePluginCommandHandler implements ICommandHandler<UpdatePluginCommand> {
	constructor(
		private readonly versionService: PluginVersionService,
		private readonly sourceService: PluginSourceService,
		private readonly pluginService: PluginService,
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

		if (!input) {
			throw new BadRequestException('Plugin update input is required');
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
				// Find the existing version by pluginId
				const existingVersion = await this.versionService.findOneByWhereOptions({
					pluginId: id
				});

				// Update the version with the existing version ID
				const updateVersionDto = {
					...input.version,
					id: existingVersion.id
				};
				await this.versionService.updateVersion(updateVersionDto, id);

				// Update sources in parallel if they exist
				if (input.version.sources?.length > 0) {
					await Promise.all(
						input.version.sources.map((source) =>
							this.sourceService.updateSource(source, existingVersion.id)
						)
					);
				}
			} // Update plugin with only provided fields
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
				requiresSubscription: input.requiresSubscription,
				...(input.categoryId && { categoryId: input.categoryId })
			};
			await this.pluginService.update(id, pluginUpdate);

			// Handle subscription plans if provided
			if (input.subscriptionPlans?.length > 0) {
				const context = {
					pluginId: id,
					tenantId: RequestContext.currentTenantId(),
					organizationId: RequestContext.currentOrganizationId(),
					userId: RequestContext.currentUser()?.id,
					commandBus: this.commandBus
				};

				// Use strategy pattern to handle create/update operations
				await Promise.all(
					input.subscriptionPlans.map((planData) =>
						SubscriptionPlanOperationFactory.execute(planData, context)
					)
				);
			}

			await queryRunner.commitTransaction();

			// Return the updated plugin with relations
			return this.pluginService.findOneByIdString(id, {
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
