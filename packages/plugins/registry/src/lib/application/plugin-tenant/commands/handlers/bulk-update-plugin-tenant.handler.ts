import { RequestContext } from '@gauzy/core';
import { BadRequestException, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginTenant, PluginTenantService } from '../../../../domain';
import { IPluginTenant, PluginTenantBulkOperation } from '../../../../shared';
import { BulkUpdatePluginTenantCommand } from '../bulk-update-plugin-tenant.command';

@CommandHandler(BulkUpdatePluginTenantCommand)
export class BulkUpdatePluginTenantCommandHandler implements ICommandHandler<BulkUpdatePluginTenantCommand> {
	private readonly logger = new Logger(BulkUpdatePluginTenantCommandHandler.name);

	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the bulk update plugin tenant command
	 *
	 * @param command - The command containing bulk operation data
	 * @returns Array of operation results
	 * @throws BadRequestException if validation fails
	 */
	public async execute(command: BulkUpdatePluginTenantCommand): Promise<{
		success: IPluginTenant[];
		failed: Array<{ id: string; error: string }>;
	}> {
		const { input } = command;

		// Validate input
		if (!input || !input.pluginTenantIds || input.pluginTenantIds.length === 0) {
			throw new BadRequestException('Plugin tenant IDs are required');
		}

		const results = {
			success: [] as IPluginTenant[],
			failed: [] as Array<{ id: string; error: string }>
		};

		const currentUser = RequestContext.currentUser();

		for (const pluginTenantId of input.pluginTenantIds) {
			try {
				// Check if plugin tenant exists
				const pluginTenant = await this.pluginTenantService.findOneByIdString(pluginTenantId);
				if (!pluginTenant) {
					results.failed.push({
						id: pluginTenantId,
						error: `Plugin tenant with ID "${pluginTenantId}" not found`
					});
					continue;
				}

				let updated: IPluginTenant;

				switch (input.operation) {
					case PluginTenantBulkOperation.ENABLE:
						updated = await this.pluginTenantService.enablePlugin(pluginTenantId);
						break;

					case PluginTenantBulkOperation.DISABLE:
						updated = await this.pluginTenantService.disablePlugin(pluginTenantId);
						break;

					case PluginTenantBulkOperation.APPROVE:
						if (!currentUser) {
							throw new Error('User context is required for approval operations');
						}
						const entity = Object.assign(new PluginTenant(), pluginTenant);
						entity.approve(currentUser);

						await this.pluginTenantService.update(pluginTenantId, {
							approvedAt: entity.approvedAt,
							approvedById: entity.approvedById,
							enabled: entity.enabled
						});

						updated = await this.pluginTenantService.findOneByIdString(pluginTenantId);
						break;

					case PluginTenantBulkOperation.REVOKE:
						const revokeEntity = Object.assign(new PluginTenant(), pluginTenant);
						revokeEntity.revokeApproval();

						await this.pluginTenantService.update(pluginTenantId, {
							approvedAt: undefined,
							approvedById: undefined,
							enabled: false
						});

						updated = await this.pluginTenantService.findOneByIdString(pluginTenantId);
						break;

					case PluginTenantBulkOperation.DELETE:
						await this.pluginTenantService.delete(pluginTenantId);
						updated = null; // No return value for deleted items
						break;

					default:
						throw new Error(`Unsupported operation: ${input.operation}`);
				}

				if (updated) {
					results.success.push(updated);
				}

				this.logger.debug(
					`Successfully executed ${input.operation} operation on plugin tenant ${pluginTenantId}`
				);
			} catch (error) {
				this.logger.error(
					`Failed to execute ${input.operation} operation on plugin tenant ${pluginTenantId}`,
					error.stack
				);
				results.failed.push({
					id: pluginTenantId,
					error: error.message
				});
			}
		}

		return results;
	}
}
