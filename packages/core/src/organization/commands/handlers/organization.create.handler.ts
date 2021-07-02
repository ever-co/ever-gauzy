import { IOrganization, RolesEnum } from '@gauzy/contracts';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as faker from 'faker';
import { getManager } from 'typeorm';
import { RoleService } from '../../../role/role.service';
import { UserService } from '../../../user/user.service';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { OrganizationService } from '../../organization.service';
import { OrganizationCreateCommand } from '../organization.create.command';
import { RequestContext } from '../../../core/context';
import { ReportOrganizationCreateCommand } from './../../../reports/commands';
import { Organization, UserOrganization } from './../../../core/entities/internal';
import { ImportRecordFirstOrCreateCommand } from './../../../export-import/import-record';


@CommandHandler(OrganizationCreateCommand)
export class OrganizationCreateHandler
	implements ICommandHandler<OrganizationCreateCommand> {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly organizationService: OrganizationService,
		private readonly userOrganizationService: UserOrganizationService,
		private readonly userService: UserService,
		private readonly roleService: RoleService,
	) {}

	public async execute(
		command: OrganizationCreateCommand
	): Promise<IOrganization> {
		const { input } = command;
		const { isImporting = false, sourceId = null } = input;

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

		let { contact = {} } = input;
		delete input['contact'];

		// 3. Create organization
		const createdOrganization: IOrganization = await this.organizationService.create({
			...input,
			show_profits: input.show_profits || false,
			show_bonuses_paid: input.show_bonuses_paid || false,
			show_income: input.show_income || false,
			show_total_hours: input.show_total_hours || false,
			show_projects_count: input.show_projects_count || true,
			show_minimum_project_size: input.show_minimum_project_size || true,
			show_clients_count: input.show_clients_count || true,
			show_clients: input.show_clients || true,
			show_employees_count: input.show_employees_count || true,
			brandColor: faker.internet.color()
		});

		// 4. Take each super admin user and add him/her to created organization
		try {
			for await (const superAdmin of superAdminUsers) {
				await this.userOrganizationService.create(
					new UserOrganization({
						organization: createdOrganization,
						tenantId,
						user: superAdmin
					})
				);
			}
		} catch (e) {
			console.log('caught', e)
		}

		//5. Create contact details of created organization
		const { id } = createdOrganization;
		contact = Object.assign({}, contact, {
			organizationId: id,
			tenantId
		});

		const organization = await this.organizationService.create({
			contact,
			...createdOrganization
		});

		//6. Create Enabled/Disabled reports for relative organization.
		await this.commandBus.execute(
			new ReportOrganizationCreateCommand(organization)
		);


		//7. Create Import Records while migrating for relative organization.
		if (isImporting && sourceId) {
			const { sourceId } = input;
			const entityType = getManager().getRepository(Organization).metadata.tableName;
			await this.commandBus.execute(
				new ImportRecordFirstOrCreateCommand({
					entityType,
					sourceId,
					destinationId: organization.id,
					tenantId
				})
			);
		}

		return await this.organizationService.findOne(id);
	}
}
