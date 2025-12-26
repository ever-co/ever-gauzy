import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PluginUserAssignmentService } from '../../../../domain/services/plugin-user-assignment.service';
import {
	AssignUsersToPluginCommand,
	BulkAssignUsersToPluginsCommand,
	UnassignUsersFromPluginCommand
} from '../../commands/plugin-user-assignment.commands';

/**
 * Handler for assigning users to a plugin
 */
@CommandHandler(AssignUsersToPluginCommand)
export class AssignUsersToPluginCommandHandler implements ICommandHandler<AssignUsersToPluginCommand> {
	constructor(private readonly userAssignmentService: PluginUserAssignmentService) {}

	async execute(command: AssignUsersToPluginCommand): Promise<any> {
		const { pluginId, userIds, reason } = command;

		const assignments = await this.userAssignmentService.assignUsersToPlugin(pluginId, userIds, reason);

		return {
			message: `Successfully assigned ${assignments.length} user(s) to plugin`,
			assignments
		};
	}
}

/**
 * Handler for unassigning users from a plugin
 */
@CommandHandler(UnassignUsersFromPluginCommand)
export class UnassignUsersFromPluginCommandHandler implements ICommandHandler<UnassignUsersFromPluginCommand> {
	constructor(private readonly userAssignmentService: PluginUserAssignmentService) {}

	async execute(command: UnassignUsersFromPluginCommand): Promise<any> {
		const { pluginId, userIds, reason } = command;

		// TODO: Implement proper logic with plugin installation service
		const revocations = await this.userAssignmentService.unassignUsersFromPlugin(pluginId, userIds, reason);

		return {
			message: `Successfully unassigned ${revocations.length} user(s) from plugin`,
			revocations
		};
	}
}

/**
 * Handler for bulk assigning users to multiple plugins
 */
@CommandHandler(BulkAssignUsersToPluginsCommand)
export class BulkAssignUsersToPluginsCommandHandler implements ICommandHandler<BulkAssignUsersToPluginsCommand> {
	constructor(private readonly userAssignmentService: PluginUserAssignmentService) {}

	async execute(command: BulkAssignUsersToPluginsCommand): Promise<any> {
		const { pluginIds, userIds, reason } = command;

		const results = [];
		for (const pluginId of pluginIds) {
			const assignments = await this.userAssignmentService.assignUsersToPlugin(pluginId, userIds, reason);
			results.push({
				pluginId,
				assignments
			});
		}

		return {
			message: `Successfully assigned users to ${pluginIds.length} plugin(s)`,
			results
		};
	}
}
