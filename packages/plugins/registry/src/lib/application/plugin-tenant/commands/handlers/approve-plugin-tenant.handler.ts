import { RequestContext } from '@gauzy/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginTenant, PluginTenantService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import { ApprovePluginTenantCommand } from '../approve-plugin-tenant.command';

@CommandHandler(ApprovePluginTenantCommand)
export class ApprovePluginTenantCommandHandler implements ICommandHandler<ApprovePluginTenantCommand> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	/**
	 * Executes the approve plugin tenant command
	 *
	 * @param command - The command containing approval data
	 * @returns The updated plugin tenant
	 * @throws BadRequestException if validation fails
	 * @throws NotFoundException if plugin tenant not found
	 */
	public async execute(command: ApprovePluginTenantCommand): Promise<IPluginTenant> {
		const { input } = command;

		// Validate input
		if (!input || !input.pluginTenantId) {
			throw new BadRequestException('Plugin tenant ID is required');
		}

		// Check if plugin tenant exists
		const pluginTenant = await this.pluginTenantService.findOneByIdString(input.pluginTenantId);
		if (!pluginTenant) {
			throw new NotFoundException(`Plugin tenant with ID "${input.pluginTenantId}" not found`);
		}

		// Get current user for approval tracking
		const currentUser = RequestContext.currentUser();
		if (!currentUser) {
			throw new BadRequestException('User context is required for approval operations');
		}

		// Convert to entity to use business logic methods
		const entity = Object.assign(new PluginTenant(), pluginTenant);

		if (input.approved) {
			// Approve the plugin
			entity.approve(currentUser);

			// Enable immediately if requested
			if (input.enableImmediately) {
				entity.enable();
			}
		} else {
			// Revoke approval
			entity.revokeApproval();
		}

		// Update in database
		await this.pluginTenantService.update(input.pluginTenantId, {
			approvedAt: entity.approvedAt,
			approvedById: entity.approvedById,
			enabled: entity.enabled
		});

		// Return updated plugin tenant with relations
		return await this.pluginTenantService.findOneByIdString(input.pluginTenantId, {
			relations: [
				'plugin',
				'approvedBy',
				'allowedRoles',
				'allowedUsers',
				'deniedUsers',
				'settings',
				'subscriptions'
			]
		});
	}
}
