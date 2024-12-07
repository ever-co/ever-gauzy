import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ID, IOrganization, IOrganizationUpdateInput } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { OrganizationService } from '../../organization.service';
import { OrganizationUpdateCommand } from '../organization.update.command';

@CommandHandler(OrganizationUpdateCommand)
export class OrganizationUpdateHandler implements ICommandHandler<OrganizationUpdateCommand> {
	constructor(private readonly organizationService: OrganizationService) {}

	/**
	 * Executes the organization update operation.
	 *
	 * @param command This includes the organization's ID and the new data to be updated.
	 * @returns A promise that resolves to the updated instance of IOrganization.
	 */
	public async execute(command: OrganizationUpdateCommand): Promise<IOrganization> {
		const { input, id } = command;
		return await this.update(id, input);
	}

	/**
	 * Updates an organization with the provided input data.
	 *
	 * @param id The unique identifier of the organization to be updated.
	 * @param input The data to update the organization with.
	 * @returns The updated organization.
	 */
	private async update(id: ID, input: IOrganizationUpdateInput): Promise<IOrganization> {
		const organization: IOrganization = await this.organizationService.findOneByIdString(id);

		if (!organization) {
			throw new NotFoundException(`Organization with ID ${id} not found.`);
		}

		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		// If any organization is set as default, update others to non-default
		if (input.isDefault) {
			await this.organizationService.update({ tenantId }, { isDefault: false });
		}

		// Simplify boolean assignments and handle optional fields like standardWorkHoursPerDay
		const updateData: Partial<IOrganizationUpdateInput> = {
			...input,
			show_profits: !!input.show_profits,
			show_bonuses_paid: !!input.show_bonuses_paid,
			show_income: !!input.show_income,
			show_total_hours: !!input.show_total_hours,
			show_projects_count: input.show_projects_count !== false,
			show_minimum_project_size: input.show_minimum_project_size !== false,
			show_clients_count: input.show_clients_count !== false,
			show_clients: input.show_clients !== false,
			show_employees_count: input.show_employees_count !== false,
			...(input.standardWorkHoursPerDay !== undefined && {
				standardWorkHoursPerDay: input.standardWorkHoursPerDay
			})
		};

		// Creates a new organization or updates an existing one based on the provided data.
		await this.organizationService.create({ ...updateData, id });

		// Return the updated organization entity
		return await this.organizationService.findOneByIdString(id);
	}
}
