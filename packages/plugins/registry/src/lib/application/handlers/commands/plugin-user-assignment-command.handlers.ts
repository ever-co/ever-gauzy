import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginUserAssignment } from '../../../domain/entities/plugin-user-assignment.entity';
import { PluginUserAssignmentService } from '../../../domain/services/plugin-user-assignment.service';
import {
	AssignUsersToPluginCommand,
	BulkAssignUsersToPluginsCommand,
	UnassignUsersFromPluginCommand
} from '../../commands/plugin-user-assignment.commands';

/**
 * Handler for AssignUsersToPluginCommand
 */
@CommandHandler(AssignUsersToPluginCommand)
export class AssignUsersToPluginCommandHandler implements ICommandHandler<AssignUsersToPluginCommand> {
	constructor(private readonly pluginUserAssignmentService: PluginUserAssignmentService) {}

	/**
	 * Execute the command to assign users to a plugin installation
	 * @param command - The assign users command
	 * @returns Array of created plugin user assignments
	 */
	async execute(command: AssignUsersToPluginCommand): Promise<PluginUserAssignment[]> {
		const { pluginInstallationId, userIds, reason } = command;
		return await this.pluginUserAssignmentService.assignUsersToPlugin(pluginInstallationId, userIds, reason);
	}
}

/**
 * Handler for UnassignUsersFromPluginCommand
 */
@CommandHandler(UnassignUsersFromPluginCommand)
export class UnassignUsersFromPluginCommandHandler implements ICommandHandler<UnassignUsersFromPluginCommand> {
	constructor(private readonly pluginUserAssignmentService: PluginUserAssignmentService) {}

	/**
	 * Execute the command to unassign users from a plugin installation
	 * @param command - The unassign users command
	 * @returns Array of updated plugin user assignments
	 */
	async execute(command: UnassignUsersFromPluginCommand): Promise<PluginUserAssignment[]> {
		const { pluginInstallationId, userIds, revocationReason } = command;
		return await this.pluginUserAssignmentService.unassignUsersFromPlugin(
			pluginInstallationId,
			userIds,
			revocationReason
		);
	}
}

/**
 * Handler for BulkAssignUsersToPluginsCommand
 */
@CommandHandler(BulkAssignUsersToPluginsCommand)
export class BulkAssignUsersToPluginsCommandHandler implements ICommandHandler<BulkAssignUsersToPluginsCommand> {
	constructor(private readonly pluginUserAssignmentService: PluginUserAssignmentService) {}

	/**
	 * Execute the command to bulk assign users to multiple plugin installations
	 * @param command - The bulk assign users command
	 * @returns Array of created plugin user assignments
	 */
	async execute(command: BulkAssignUsersToPluginsCommand): Promise<PluginUserAssignment[]> {
		const { pluginInstallationIds, userIds, reason } = command;
		return await this.pluginUserAssignmentService.bulkAssignUsersToPlugins(pluginInstallationIds, userIds, reason);
	}
}
