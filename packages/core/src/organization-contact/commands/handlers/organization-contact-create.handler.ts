import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { In } from 'typeorm';
import { IEmployee, IOrganizationContact, IOrganizationProject, IOrganizationProjectEmployee } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { RequestContext } from '../../../core/context';
import { OrganizationContactCreateCommand } from '../organization-contact-create.command';
import { OrganizationContactService } from '../../organization-contact.service';
import { OrganizationProjectService } from '../../../organization-project/organization-project.service';
import { ContactService } from '../../../contact/contact.service';

@CommandHandler(OrganizationContactCreateCommand)
export class OrganizationContactCreateHandler implements ICommandHandler<OrganizationContactCreateCommand> {
	constructor(
		private readonly _organizationContactService: OrganizationContactService,
		private readonly _organizationProjectService: OrganizationProjectService,
		private readonly _contactService: ContactService
	) {}

	/**
	 * Executes the creation of an organization contact.
	 *
	 * @param command An instance of OrganizationContactCreateCommand containing the necessary input for creating a new organization contact.
	 * @returns A promise that resolves to the newly created organization contact (IOrganizationContact).
	 */
	public async execute(command: OrganizationContactCreateCommand): Promise<IOrganizationContact> {
		try {
			const { input } = command;

			const organizationId = input.organizationId;
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// If members are empty and projects are provided, populate members from projects
			if (isEmpty(input.members) && isNotEmpty(input.projects)) {
				const projectIds = input.projects.map((project: IOrganizationProject) => project.id);

				// Retrieve projects with specified IDs, belonging to the given organization and tenant.
				const projects = await this._organizationProjectService.find({
					where: {
						id: In(projectIds),
						organization: { id: organizationId },
						tenantId
					},
					relations: { members: true }
				});

				// Extract all project employees
				const projectEmployees: IOrganizationProjectEmployee[] = projects.flatMap(
					(project: IOrganizationProject) => project.members
				);

				// Map each project employee to IEmployee
				const projectMembers: IEmployee[] = await Promise.all(
					projectEmployees
						.flatMap((projectEmployee: IOrganizationProjectEmployee) => projectEmployee.employee)
						.map((employee: IEmployee) => employee)
				);

				// Assign to input.members, ensuring input.members is initialized
				input.members = [...(input.members || []), ...projectMembers];
			}

			// Create contact details of organization
			try {
				input.contact = await this._contactService.create({
					...input.contact,
					organizationId,
					tenantId,
					organization: { id: organizationId },
					tenant: { id: tenantId }
				});
			} catch (error) {
				throw new BadRequestException('Failed to create contact details', error.message);
			}

			// Create a new organization contact with the modified input
			return await this._organizationContactService.create({
				...input,
				organizationId,
				organization: { id: organizationId },
				tenantId,
				tenant: { id: tenantId }
			});
		} catch (error) {
			throw new BadRequestException('Failed to create organization contact', error.message);
		}
	}
}
