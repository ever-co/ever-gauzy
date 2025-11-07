import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { IPagination } from '../../../../../../../dist/packages/contracts/src/lib/core.model';
import { PluginInstallationStatus } from '../../shared/models/plugin-installation.model';
import { PluginScope } from '../../shared/models/plugin-scope.model';
import { PluginSubscriptionStatus } from '../../shared/models/plugin-subscription.model';
import { IPluginUserAssignmentFindInput } from '../../shared/models/plugin-user-assignment.model';
import { PluginUserAssignment } from '../entities/plugin-user-assignment.entity';
import { MikroOrmPluginUserAssignmentRepository } from '../repositories/mikro-orm-plugin-user-assignment.repository';
import { TypeOrmPluginUserAssignmentRepository } from '../repositories/type-orm-plugin-user-assignment.repository';
import { PluginInstallationService } from './plugin-installation.service';
import { PluginSubscriptionService } from './plugin-subscription.service';

@Injectable()
export class PluginUserAssignmentService extends TenantAwareCrudService<PluginUserAssignment> {
	constructor(
		public readonly typeOrmPluginUserAssignmentRepository: TypeOrmPluginUserAssignmentRepository,
		public readonly mikroOrmPluginUserAssignmentRepository: MikroOrmPluginUserAssignmentRepository,
		private readonly pluginInstallationService: PluginInstallationService,
		private readonly pluginSubscriptionService: PluginSubscriptionService
	) {
		super(typeOrmPluginUserAssignmentRepository, mikroOrmPluginUserAssignmentRepository);
	}

	/**
	 * Assign users to a plugin installation
	 * @param pluginInstallationId - The plugin installation ID
	 * @param userIds - Array of user IDs to assign
	 * @param reason - Optional reason for assignment
	 * @returns Array of created plugin user assignments
	 */
	async assignUsersToPlugin(
		pluginInstallationId: ID,
		userIds: ID[],
		reason?: string
	): Promise<PluginUserAssignment[]> {
		const currentUserId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		// Validate plugin installation exists and get plugin details
		const pluginInstallation = await this.pluginInstallationService.findOneByOptions({
			where: {
				id: pluginInstallationId,
				tenantId,
				organizationId,
				status: PluginInstallationStatus.INSTALLED
			},
			relations: ['plugin', 'version']
		});

		if (!pluginInstallation) {
			throw new NotFoundException('Plugin installation not found');
		}

		// Check if the plugin subscription allows user assignment (organization/tenant scope)
		await this.validatePluginSubscriptionScope(pluginInstallation.pluginId, tenantId, organizationId);

		// Check for existing assignments to avoid duplicates
		const existingAssignments = await this.find({
			where: {
				pluginInstallationId,
				userId: In(userIds),
				isActive: true,
				tenantId,
				organizationId
			}
		});

		const existingUserIds = existingAssignments.map((assignment) => assignment.userId);
		const newUserIds = userIds.filter((userId) => !existingUserIds.includes(userId));

		if (newUserIds.length === 0) {
			throw new BadRequestException('All specified users are already assigned to this plugin');
		}

		// Create new assignments
		const assignments: PluginUserAssignment[] = [];
		for (const userId of newUserIds) {
			const assignment = Object.assign(new PluginUserAssignment(), {
				pluginInstallationId,
				userId,
				assignedById: currentUserId,
				assignedAt: new Date(),
				reason,
				isActive: true,
				tenantId,
				organizationId
			});
			assignments.push(assignment);
		}

		// Save each assignment individually
		const savedAssignments: PluginUserAssignment[] = [];
		for (const assignment of assignments) {
			const saved = await this.save(assignment);
			savedAssignments.push(saved);
		}

		return savedAssignments;
	}

	/**
	 * Unassign users from a plugin installation
	 * @param pluginInstallationId - The plugin installation ID
	 * @param userIds - Array of user IDs to unassign
	 * @param revocationReason - Optional reason for revocation
	 * @returns Array of updated plugin user assignments
	 */
	async unassignUsersFromPlugin(
		pluginInstallationId: ID,
		userIds: ID[],
		revocationReason?: string
	): Promise<PluginUserAssignment[]> {
		const currentUserId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		// Find existing active assignments
		const existingAssignments = await this.find({
			where: {
				pluginInstallationId,
				userId: In(userIds),
				isActive: true,
				tenantId,
				organizationId
			}
		});

		if (existingAssignments.length === 0) {
			throw new NotFoundException('No active assignments found for the specified users');
		}

		// Update assignments to mark them as inactive
		const updatedAssignments: PluginUserAssignment[] = [];
		for (const assignment of existingAssignments) {
			assignment.isActive = false;
			assignment.revokedAt = new Date();
			assignment.revokedById = currentUserId;
			assignment.revocationReason = revocationReason;
			const updated = await this.save(assignment);
			updatedAssignments.push(updated);
		}

		return updatedAssignments;
	}

	/**
	 * Get all user assignments for a plugin installation
	 * @param pluginInstallationId - The plugin installation ID
	 * @param includeInactive - Whether to include inactive assignments
	 * @param take - Number of items to take
	 * @param skip - Number of items to skip
	 * @returns Array of plugin user assignments
	 */
	async getPluginUserAssignments(
		pluginInstallationId: ID,
		includeInactive: boolean = false,
		take?: number,
		skip?: number
	): Promise<IPagination<PluginUserAssignment>> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		const where: IPluginUserAssignmentFindInput = {
			pluginInstallationId,
			...(includeInactive ? {} : { isActive: true })
		};

		return this.findAll({
			where: {
				...where,
				tenantId,
				organizationId
			},
			relations: ['user', 'assignedBy', 'revokedBy', 'pluginInstallation'],
			...(take && { take }),
			...(skip && { skip })
		});
	}

	/**
	 * Get all plugin assignments for a user
	 * @param userId - The user ID
	 * @param includeInactive - Whether to include inactive assignments
	 * @param take - Number of items to take
	 * @param skip - Number of items to skip
	 * @returns Array of plugin user assignments
	 */
	async getUserPluginAssignments(
		userId: ID,
		includeInactive: boolean = false,
		take?: number,
		skip?: number
	): Promise<IPagination<PluginUserAssignment>> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		const where: IPluginUserAssignmentFindInput = {
			userId,
			...(includeInactive ? {} : { isActive: true })
		};

		return this.findAll({
			where: {
				...where,
				tenantId,
				organizationId
			},
			relations: ['user', 'assignedBy', 'revokedBy', 'pluginInstallation'],
			...(take && { take }),
			...(skip && { skip })
		});
	}

	/**
	 * Check if a user has access to a specific plugin installation
	 * @param pluginInstallationId - The plugin installation ID
	 * @param userId - The user ID
	 * @returns Boolean indicating if user has access
	 */
	async hasUserAccessToPlugin(input: { pluginInstallationId?: ID; pluginId?: ID }, userId: ID): Promise<boolean> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const { pluginInstallationId, pluginId } = input;

		const assignment = await this.findOneOrFailByWhereOptions({
			pluginInstallation: {
				...(pluginInstallationId && { id: pluginInstallationId }),
				...(pluginId && {
					pluginId
				})
			},
			revokedAt: IsNull(),
			revokedById: IsNull(),
			userId,
			isActive: true,
			tenantId,
			organizationId
		});

		return assignment.success;
	}

	/**
	 * Validate that the plugin subscription allows user assignment
	 * @param pluginId - The plugin ID
	 * @param tenantId - The tenant ID
	 * @param organizationId - The organization ID
	 * @throws ForbiddenException if plugin is not purchased for organization/tenant scope
	 */
	private async validatePluginSubscriptionScope(pluginId: ID, tenantId: ID, organizationId: ID): Promise<void> {
		// Find active subscription for this plugin at organization or tenant level
		const subscription = await this.pluginSubscriptionService.findOneByWhereOptions({
			pluginId,
			tenantId,
			organizationId,
			status: PluginSubscriptionStatus.ACTIVE,
			scope: In([PluginScope.ORGANIZATION, PluginScope.TENANT])
		});

		if (!subscription) {
			throw new ForbiddenException('Plugin must be purchased for organization or tenant scope to assign users');
		}
	}

	/**
	 * Bulk assign users to multiple plugin installations
	 * @param pluginInstallationIds - Array of plugin installation IDs
	 * @param userIds - Array of user IDs to assign
	 * @param reason - Optional reason for assignment
	 * @returns Array of created plugin user assignments
	 */
	async bulkAssignUsersToPlugins(
		pluginInstallationIds: ID[],
		userIds: ID[],
		reason?: string
	): Promise<PluginUserAssignment[]> {
		const allAssignments: PluginUserAssignment[] = [];

		for (const pluginInstallationId of pluginInstallationIds) {
			try {
				const assignments = await this.assignUsersToPlugin(pluginInstallationId, userIds, reason);
				allAssignments.push(...assignments);
			} catch (error) {
				// Log error but continue with other assignments
				console.error(`Failed to assign users to plugin installation ${pluginInstallationId}:`, error);
			}
		}

		return allAssignments;
	}
}
