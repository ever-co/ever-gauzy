import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { faker } from '@ever-co/faker';
import { IOrganization, IUser, RolesEnum } from '@gauzy/contracts';
import { UserService } from '../../../user/user.service';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { OrganizationService } from '../../organization.service';
import { OrganizationCreateCommand } from '../organization.create.command';
import { ReportOrganizationCreateCommand } from './../../../reports/commands';
import { RequestContext } from '../../../core/context';
import { UserOrganization } from './../../../core/entities/internal';
import { Organization } from './../../organization.entity';
import { ImportRecordUpdateOrCreateCommand } from './../../../export-import/import-record';
import { OrganizationStatusBulkCreateCommand } from './../../../tasks/statuses/commands';
import { OrganizationTaskSizeBulkCreateCommand } from './../../../tasks/sizes/commands';
import { OrganizationTaskPriorityBulkCreateCommand } from './../../../tasks/priorities/commands';

@CommandHandler(OrganizationCreateCommand)
export class OrganizationCreateHandler
	implements ICommandHandler<OrganizationCreateCommand> {

	constructor(
		private readonly commandBus: CommandBus,
		private readonly organizationService: OrganizationService,
		private readonly userOrganizationService: UserOrganizationService,
		private readonly userService: UserService,
		@InjectRepository(Organization) private readonly organizationRepository: Repository<Organization>,
		@InjectRepository(UserOrganization) private readonly userOrganizationRepository: Repository<UserOrganization>,
	) { }

	public async execute(
		command: OrganizationCreateCommand
	): Promise<IOrganization> {
		try {
			const { input } = command;
			const { isImporting = false, sourceId = null, userOrganizationSourceId = null } = input;
			const tenantId = RequestContext.currentTenantId();

			const admins: IUser[] = [];

			// 1. Get all Super Admin Users of the Tenant
			const { items: superAdminUsers } = await this.userService.findAll({
				where: {
					tenantId,
					role: {
						name: RolesEnum.SUPER_ADMIN,
						tenantId
					}
				}
			});
			admins.push(...superAdminUsers);

			// 2. Organization will add to all SUPER_ADMIN/ADMIN users, if ADMIN create organization.
			if (RequestContext.hasRole(RolesEnum.ADMIN)) {
				const { items: adminUsers } = await this.userService.findAll({
					where: {
						tenantId,
						role: {
							name: RolesEnum.ADMIN,
							tenantId
						}
					}
				});
				admins.push(...adminUsers);
			}

			let { contact = {} } = input;
			delete input['contact'];

			// 3. Create organization
			const createdOrganization: IOrganization = await this.organizationService.create({
				...input,
				futureDateAllowed: input.futureDateAllowed === false ? false : true,
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
				for await (const admin of admins) {
					const userOrganization = await this.userOrganizationService.create(
						new UserOrganization({
							organization: createdOrganization,
							tenantId,
							user: admin
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

			// 5. Create contact details of created organization
			const { id } = createdOrganization;
			contact = Object.assign({}, contact, {
				organizationId: id,
				tenantId
			});

			const organization = await this.organizationService.create({
				contact,
				...createdOrganization
			});

			// 6. Create Enabled/Disabled reports for relative organization.
			await this.commandBus.execute(
				new ReportOrganizationCreateCommand(organization)
			);

			// 7. Create task statuses for relative organization.
			await this.commandBus.execute(
				new OrganizationStatusBulkCreateCommand(organization)
			);

			// 8. Create task sizes for relative organization.
			await this.commandBus.execute(
				new OrganizationTaskSizeBulkCreateCommand(organization)
			);

			// 9. Create task priorities for relative organization.
			await this.commandBus.execute(
				new OrganizationTaskPriorityBulkCreateCommand(organization)
			);

			// 10. Create Import Records while migrating for relative organization.
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
