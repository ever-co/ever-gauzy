import { IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginUserAssignment } from '../../../domain/entities/plugin-user-assignment.entity';
import { PluginUserAssignmentService } from '../../../domain/services/plugin-user-assignment.service';
import {
	CheckUserPluginAccessQuery,
	GetAllPluginUserAssignmentsQuery,
	GetPluginUserAssignmentsQuery,
	GetUserPluginAssignmentsQuery
} from '../../queries/plugin-user-assignment.queries';

/**
 * Handler for GetPluginUserAssignmentsQuery
 */
@QueryHandler(GetPluginUserAssignmentsQuery)
export class GetPluginUserAssignmentsQueryHandler implements IQueryHandler<GetPluginUserAssignmentsQuery> {
	constructor(private readonly pluginUserAssignmentService: PluginUserAssignmentService) {}

	/**
	 * Execute the query to get all user assignments for a plugin installation
	 * @param query - The get plugin user assignments query
	 * @returns Array of plugin user assignments
	 */
	async execute(query: GetPluginUserAssignmentsQuery): Promise<IPagination<PluginUserAssignment>> {
		const { pluginInstallationId, includeInactive, take, skip } = query;
		return this.pluginUserAssignmentService.getPluginUserAssignments(
			pluginInstallationId,
			includeInactive,
			take,
			skip
		);
	}
}

/**
 * Handler for GetUserPluginAssignmentsQuery
 */
@QueryHandler(GetUserPluginAssignmentsQuery)
export class GetUserPluginAssignmentsQueryHandler implements IQueryHandler<GetUserPluginAssignmentsQuery> {
	constructor(private readonly pluginUserAssignmentService: PluginUserAssignmentService) {}

	/**
	 * Execute the query to get all plugin assignments for a user
	 * @param query - The get user plugin assignments query
	 * @returns Array of plugin user assignments
	 */
	async execute(query: GetUserPluginAssignmentsQuery): Promise<IPagination<PluginUserAssignment>> {
		const { userId, includeInactive, take, skip } = query;
		return this.pluginUserAssignmentService.getUserPluginAssignments(userId, includeInactive, take, skip);
	}
}

/**
 * Handler for CheckUserPluginAccessQuery
 */
@QueryHandler(CheckUserPluginAccessQuery)
export class CheckUserPluginAccessQueryHandler implements IQueryHandler<CheckUserPluginAccessQuery> {
	constructor(private readonly pluginUserAssignmentService: PluginUserAssignmentService) {}

	/**
	 * Execute the query to check if a user has access to a specific plugin installation
	 * @param query - The check user plugin access query
	 * @returns Boolean indicating if user has access
	 */
	async execute(query: CheckUserPluginAccessQuery): Promise<boolean> {
		const { pluginInstallationId, userId } = query;
		return await this.pluginUserAssignmentService.hasUserAccessToPlugin({ pluginInstallationId }, userId);
	}
}

/**
 * Handler for GetAllPluginUserAssignmentsQuery
 */
@QueryHandler(GetAllPluginUserAssignmentsQuery)
export class GetAllPluginUserAssignmentsQueryHandler implements IQueryHandler<GetAllPluginUserAssignmentsQuery> {
	constructor(private readonly pluginUserAssignmentService: PluginUserAssignmentService) {}

	/**
	 * Execute the query to get all plugin user assignments with optional filters
	 * @param query - The get all plugin user assignments query
	 * @returns Array of plugin user assignments
	 */
	async execute(query: GetAllPluginUserAssignmentsQuery): Promise<IPagination<PluginUserAssignment>> {
		const { filters } = query;

		if (!filters) {
			const result = await this.pluginUserAssignmentService.findAll({
				relations: ['user', 'assignedBy', 'revokedBy', 'pluginInstallation']
			});
			return result;
		}

		// Build where clause based on filters
		const where: any = {};
		if (filters.userId) where.userId = filters.userId;
		if (filters.assignedById) where.assignedById = filters.assignedById;
		if (filters.isActive !== undefined) where.isActive = filters.isActive;

		// If pluginId filter is provided, we need to join with plugin installation
		if (filters.pluginId) {
			return this.pluginUserAssignmentService.findAll({
				where: {
					...where,
					pluginInstallation: {
						pluginId: filters.pluginId
					}
				},
				relations: ['user', 'assignedBy', 'revokedBy', 'pluginInstallation']
			});
		}

		return this.pluginUserAssignmentService.findAll({
			where,
			relations: ['user', 'assignedBy', 'revokedBy', 'pluginInstallation']
		});
	}
}
