import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { RolesEnum, ID, IRole } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { UserOrganizationDeleteCommand } from '../user-organization.delete.command';
import { UserOrganization } from '../../user-organization.entity';
import { UserService } from '../../../user/user.service';
import { UserOrganizationService } from '../../user-organization.services';
import { RoleService } from '../../../role/role.service';

/**
 * 1. Remove user from given organization if user belongs to multiple organizations
 * 2. Remove user record if the user belongs only to the given organization
 * 3. Allow the deletion of Admin and Super Admin Users only if there are more than 1 users of that Role.
 * 4. When a Super Admins are deleted, they must be removed from all existing organizations.
 * 5. Super Admin user can be deleted only by a Super Admin user.
 */
@CommandHandler(UserOrganizationDeleteCommand)
export class UserOrganizationDeleteHandler implements ICommandHandler<UserOrganizationDeleteCommand> {
	constructor(
		private readonly _userOrganizationService: UserOrganizationService,
		private readonly _userService: UserService,
		private readonly _roleService: RoleService
	) {}

	/**
	 * Executes a command to delete a user organization association.
	 *
	 * @param command The delete command containing input data.
	 * @returns A promise resolving to either the deleted UserOrganization or DeleteResult.
	 */
	public async execute(command: UserOrganizationDeleteCommand): Promise<UserOrganization | DeleteResult> {
		const { userOrganizationId } = command;

		// 1. Find user and their role to determine deletion handling
		const {
			user: {
				role: { name: roleName }
			},
			userId
		} = await this._userOrganizationService.findOneByIdString(userOrganizationId, {
			relations: { user: { role: true } }
		});

		// 2. Handle Super Admin Deletion if applicable
		if (roleName === RolesEnum.SUPER_ADMIN) {
			return await this._removeSuperAdmin(userId);
		}

		// 3. Remove user from organization based on the number of organizations they belong to
		return await this._removeUserFromOrganization(userId, userOrganizationId);
	}

	/**
	 * Remove user from organization based on the number of organizations they belong to.
	 *
	 * @param userId The ID of the user to remove.
	 * @param userOrganizationId The ID of the user organization association to remove.
	 * @returns A promise resolving to either the deleted UserOrganization or DeleteResult.
	 */
	private async _removeUserFromOrganization(
		userId: ID,
		userOrganizationId: ID
	): Promise<UserOrganization | DeleteResult> {
		// 1. Get count of organizations the user belongs to
		const total = await this._userOrganizationService.countBy({ userId });

		// Decide whether to delete user or user organization based on the count
		if (total === 1) {
			return await this._userService.delete(userId); // Delete the user if they belong to only one organization
		}
		return await this._userOrganizationService.delete(userOrganizationId); // Delete the user organization association if they belong to multiple organizations
	}

	/**
	 * Remove a Super Admin user from the system.
	 *
	 * @param id The ID of the Super Admin user to be removed.
	 * @returns A promise resolving to either the deleted UserOrganization or DeleteResult.
	 */
	private async _removeSuperAdmin(id: ID): Promise<UserOrganization | DeleteResult> {
		const currentRoleId = RequestContext.currentRoleId();
		const currentTenantId = RequestContext.currentTenantId();

		// 1. Check if the requesting user has permission to delete Super Admin
		const role: IRole = await this._roleService.findOneByIdString(currentRoleId);

		if (role.name !== RolesEnum.SUPER_ADMIN) {
			throw new UnauthorizedException('Only Super Admin users can delete Super Admin users');
		}

		// 2. Check if there are at least 2 Super Admins before deleting Super Admin user
		const total = await this._userService.countBy({
			role: { id: currentRoleId },
			tenant: { id: currentTenantId }
		});

		if (total === 1) {
			throw new BadRequestException(`There must be at least ${total} Super Admin per Tenant`);
		}

		// 3. Delete Super Admin user from all organizations
		return await this._userService.delete(id);
	}
}
