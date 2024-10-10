import { BadRequestException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { faker } from '@faker-js/faker';
import { IOrganization, IUser, RolesEnum } from '@gauzy/contracts';
import { UserService } from '../../../user/user.service';
import { UserOrganizationService } from '../../../user-organization/user-organization.services';
import { OrganizationService } from '../../organization.service';
import { ContactService } from '../../../contact/contact.service';
import { OrganizationCreateCommand } from '../organization.create.command';
import { ReportOrganizationCreateCommand } from './../../../reports/commands';
import { RequestContext } from '../../../core/context';
import { Organization } from './../../../core/entities/internal';
import { ImportRecordUpdateOrCreateCommand } from './../../../export-import/import-record';
import { OrganizationStatusBulkCreateCommand } from './../../../tasks/statuses/commands';
import { OrganizationTaskSizeBulkCreateCommand } from './../../../tasks/sizes/commands';
import { OrganizationTaskPriorityBulkCreateCommand } from './../../../tasks/priorities/commands';
import { OrganizationIssueTypeBulkCreateCommand } from './../../../tasks/issue-type/commands';
import { OrganizationTaskSettingCreateCommand } from '../../../organization-task-setting/commands';

@CommandHandler(OrganizationCreateCommand)
export class OrganizationCreateHandler implements ICommandHandler<OrganizationCreateCommand> {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly organizationService: OrganizationService,
		private readonly userOrganizationService: UserOrganizationService,
		private readonly userService: UserService,
		private readonly contactService: ContactService
	) {}

	/**
	 * Asynchronously executes the process of creating a new organization, along with associated tasks such as
	 * adding users to the organization, creating contact details, executing various update tasks, and handling import records.
	 * This function encapsulates several steps, each responsible for a part of the organization creation process.
	 *
	 * @param command An instance of OrganizationCreateCommand, containing the input data and settings required to create the organization.
	 * @returns A promise that resolves to an instance of IOrganization, representing the newly created organization.
	 */
	public async execute(command: OrganizationCreateCommand): Promise<IOrganization> {
		try {
			const { input } = command;
			const { isImporting = false, sourceId = null, userOrganizationSourceId = null } = input;
			const tenantId = RequestContext.currentTenantId();

			const admins: IUser[] = [];

			// 1. Get all Super Admin Users of the Tenant
			const superAdminUsers = await this.userService.find({
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
				const adminUsers = await this.userService.find({
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
			const organization: IOrganization = await this.organizationService.create({
				...input,
				upworkOrganizationId: input.upworkOrganizationId || null,
				upworkOrganizationName: input.upworkOrganizationName || null,
				// Simplify boolean assignments
				futureDateAllowed: input.futureDateAllowed !== false,
				show_profits: input.show_profits === true,
				show_bonuses_paid: input.show_bonuses_paid === true,
				show_income: input.show_income === true,
				show_total_hours: input.show_total_hours === true,
				show_projects_count: input.show_projects_count !== false,
				show_minimum_project_size: input.show_minimum_project_size !== false,
				show_clients_count: input.show_clients_count !== false,
				show_clients: input.show_clients !== false,
				show_employees_count: input.show_employees_count !== false,
				brandColor: faker.internet.color(),
				...(input.standardWorkHoursPerDay && {
					standardWorkHoursPerDay: input.standardWorkHoursPerDay
				})
			});
			const { id: organizationId } = organization;

			// 4. Take each super admin user and add him/her to created organization
			try {
				const userOrganizations = admins.map(async (user: IUser) => {
					const userOrganization = await this.userOrganizationService.create({
						organization: {
							id: organizationId
						},
						user
					});
					if (isImporting && userOrganizationSourceId) {
						await this.commandBus.execute(
							new ImportRecordUpdateOrCreateCommand({
								entityType: this.userOrganizationService.tableName,
								sourceId: userOrganizationSourceId,
								destinationId: userOrganization.id,
								tenantId
							})
						);
					}
				});
				await Promise.all(userOrganizations);
			} catch (e) {
				console.log('An error occurred while processing user organizations. Details:', e);
			}

			// 5. Create contact details of created organization
			try {
				contact = await this.contactService.create({
					...contact,
					organization: { id: organizationId }
				});
				await this.organizationService.update(organizationId, {
					contactId: contact.id
				});
			} catch (error) {
				console.log('Error occurred during creation of contact details or updating the organization:', error);
			}

			// 6. Executes various organization update tasks concurrently.
			this.executeOrganizationUpdateTasks(organization);

			// 7. Create Import Records while migrating for relative organization.
			if (isImporting && sourceId) {
				const { sourceId } = input;
				await this.commandBus.execute(
					new ImportRecordUpdateOrCreateCommand({
						entityType: this.organizationService.tableName,
						sourceId,
						destinationId: organizationId,
						tenantId
					})
				);
			}
			return await this.organizationService.findOneByIdString(organizationId);
		} catch (error) {
			console.log('An error occurred during the organization creation process.', error);
			throw new BadRequestException(error, 'An error occurred during the organization creation process.');
		}
	}

	/**
	 * Executes various organization update tasks concurrently. This function
	 * triggers several operations related to an organization, such as creating reports,
	 * task statuses, task sizes, task priorities, issue types, and task settings.
	 * These operations are executed in parallel. If any operation fails,
	 * the error is caught and logged.
	 *
	 * @param organization An instance of the Organization class, representing the organization for which the update tasks are to be executed.
	 * @param organizationId The unique identifier of the organization, used in some of the update tasks.
	 * @returns Promise<void> This function returns a promise that resolves to void.
	 */
	public async executeOrganizationUpdateTasks(organization: Organization): Promise<void> {
		try {
			// 1. Create report for relative organization.
			await this.commandBus.execute(new ReportOrganizationCreateCommand(organization));
			// 2. Create task statuses for relative organization.
			await this.commandBus.execute(new OrganizationStatusBulkCreateCommand(organization));
			// 3. Create task sizes for relative organization.
			await this.commandBus.execute(new OrganizationTaskSizeBulkCreateCommand(organization));
			// 4. Create task priorities for relative organization.
			await this.commandBus.execute(new OrganizationTaskPriorityBulkCreateCommand(organization));
			// 5. Create issue types for relative organization.
			await this.commandBus.execute(new OrganizationIssueTypeBulkCreateCommand(organization));
			// 6. Create task setting for relative organization.
			await this.commandBus.execute(
				new OrganizationTaskSettingCreateCommand({
					organization
				})
			);
		} catch (error) {
			console.log(error, 'Error occurred while executing organization update tasks:', error.message);
		}
	}
}
