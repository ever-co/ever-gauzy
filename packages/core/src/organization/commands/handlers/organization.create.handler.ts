import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { faker } from '@ever-co/faker';
import { IOrganization, RolesEnum } from '@gauzy/contracts';
import { RoleService } from '../../../role/role.service';
import { UserService } from '../../../user/user.service';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { OrganizationService } from '../../organization.service';
import { OrganizationCreateCommand } from '../organization.create.command';
import { RequestContext } from '../../../core/context';
import { ReportOrganizationCreateCommand } from './../../../reports/commands';
import { Organization, UserOrganization } from './../../../core/entities/internal';
import { ImportRecordUpdateOrCreateCommand } from './../../../export-import/import-record';


@CommandHandler(OrganizationCreateCommand)
export class OrganizationCreateHandler
	implements ICommandHandler<OrganizationCreateCommand> {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly organizationService: OrganizationService,
		private readonly userOrganizationService: UserOrganizationService,
		private readonly userService: UserService,
		private readonly roleService: RoleService,
		@InjectRepository(UserOrganization) private readonly userOrganizationRepository: Repository<UserOrganization>,
		@InjectRepository(Organization) private readonly organizationRepository: Repository<Organization>,
	) {}

	public async execute(
		command: OrganizationCreateCommand
	): Promise<IOrganization> {
		try {
			const { input } = command;
			const { isImporting = false, sourceId = null, userOrganizationSourceId = null } = input;

			//1. Get roleId for Super Admin user of the Tenant
			const { id: roleId } = await this.roleService.findOneByOptions({
				where: {
					name: RolesEnum.SUPER_ADMIN,
					tenantId: RequestContext.currentTenantId()
				}
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
				show_profits: input.show_profits === true ? true : false,
				show_bonuses_paid: input.show_bonuses_paid === true ? true : false,
				show_income: input.show_income === true ? true : false,
				show_total_hours: input.show_total_hours === true ? true : false,
				show_projects_count: input.show_projects_count === false ? false : true,
				show_minimum_project_size: input.show_minimum_project_size === false ? false : true,
				show_clients_count: input.show_clients_count === false ? false : true,
				show_clients: input.show_clients === false ? false : true,
				show_employees_count: input.show_employees_count === false ? false : true,
				brandColor: faker.internet.color()
			});

			// 4. Take each super admin user and add him/her to created organization
			try {
				for await (const superAdmin of superAdminUsers) {
					const userOrganization = await this.userOrganizationService.create(
						new UserOrganization({
							organization: createdOrganization,
							tenantId,
							user: superAdmin
						})
					);
					if (isImporting && userOrganizationSourceId) {
						await this.commandBus.execute(
							new ImportRecordUpdateOrCreateCommand({
								entityType: this.userOrganizationRepository.metadata.tableName,
								sourceId: userOrganizationSourceId,
								destinationId: userOrganization.id,
								tenantId
							})
						);
					}
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
				await this.commandBus.execute(
					new ImportRecordUpdateOrCreateCommand({
						entityType: this.organizationRepository.metadata.tableName,
						sourceId,
						destinationId: organization.id,
						tenantId
					})
				);
			}
			return await this.organizationService.findOneByIdString(id);
		} catch (error) {
			console.log(error, 'Error while creating organization');
			throw new BadRequestException(error, 'Error while creating organization');
		}
	}
}
