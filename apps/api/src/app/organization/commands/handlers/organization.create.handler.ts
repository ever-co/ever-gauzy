import { Organization, RolesEnum } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RoleService } from '../../../role/role.service';
import { UserService } from '../../../user/user.service';
import { UserOrganization } from '../../../user-organization/user-organization.entity';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { OrganizationService } from '../../organization.service';
import { OrganizationCreateCommand } from '../organization.create.command';

@CommandHandler(OrganizationCreateCommand)
export class OrganizationCreateHandler
	implements ICommandHandler<OrganizationCreateCommand> {
	constructor(
		private readonly organizationService: OrganizationService,
		private readonly userOrganizationService: UserOrganizationService,
		private readonly userService: UserService,
		private readonly roleService: RoleService
	) {}

	public async execute(
		command: OrganizationCreateCommand
	): Promise<Organization> {
		const { input } = command;

		//1. Get roleId for Super Admin user

		// SUPER ADMIN DOES NOT EXIST, CHANGED ONLY FOR TESTING INTEGRATION
		const { id: roleId } = await this.roleService.findOne({
			name: RolesEnum.ADMIN
		});

		// 2. Get all Super Admin Users
		const { items: superAdminUsers } = await this.userService.findAll({
			relations: ['role'],
			where: { role: { id: roleId } }
		});

		// 3. Create organization
		const createdOrganization: Organization = await this.organizationService.create(
			input
		);

		// 4. Take each super admin user and add him/her to created organization
		superAdminUsers.forEach((user) => {
			const userOrganization = new UserOrganization();
			userOrganization.orgId = createdOrganization.id;
			userOrganization.userId = user.id;
			this.userOrganizationService.create(userOrganization);
		});

		return createdOrganization;
	}
}
