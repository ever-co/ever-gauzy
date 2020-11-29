import { IOrganization, RolesEnum } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RoleService } from '../../../role/role.service';
import { UserService } from '../../../user/user.service';
import { UserOrganization } from '../../../user-organization/user-organization.entity';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { OrganizationService } from '../../organization.service';
import { OrganizationCreateCommand } from '../organization.create.command';
import { RequestContext } from '../../../core/context';

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
	): Promise<IOrganization> {
		const { input } = command;

		//1. Get roleId for Super Admin user of the Tenant
		const { id: roleId } = await this.roleService.findOne({
			name: RolesEnum.SUPER_ADMIN
		});

		// 2. Get all Super Admin Users of the Tenant
		// have to get user from context, as user service is not tenant-aware
		const user = RequestContext.currentUser();
		const { tenantId } = user;

		const { items: superAdminUsers } = await this.userService.findAll({
			relations: ['role'],
			where: {
				tenant: { id: tenantId },
				role: { id: roleId }
			}
		});

		let { contact } = input;
		delete input['contact'];

		// 3. Create organization
		const createdOrganization: IOrganization = await this.organizationService.create(
			{
				...input,
				show_profits: false,
				show_bonuses_paid: false,
				show_income: false,
				show_total_hours: false,
				show_projects_count: true,
				show_minimum_project_size: true,
				show_clients_count: true,
				show_clients: true,
				show_employees_count: true
			}
		);

		// 4. Take each super admin user and add him/her to created organization
		superAdminUsers.forEach((superAdmin) => {
			const userOrganization = new UserOrganization();
			userOrganization.organizationId = createdOrganization.id;
			userOrganization.tenantId = tenantId;
			userOrganization.userId = superAdmin.id;
			this.userOrganizationService.create(userOrganization);
		});

		//5. Create contact details of created organization
		const { id } = createdOrganization;
		contact = Object.assign(contact, { organizationId: id, tenantId });
		await this.organizationService.create({
			contact,
			...createdOrganization
		});

		return await this.organizationService.findOne(id);
	}
}
