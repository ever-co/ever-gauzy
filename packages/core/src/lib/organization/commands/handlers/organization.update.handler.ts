import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ID, IOrganization, IOrganizationUpdateInput, validateAgentExitLogoutRestriction } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { OrganizationService } from '../../organization.service';
import { OrganizationUpdateCommand } from '../organization.update.command';

@CommandHandler(OrganizationUpdateCommand)
export class OrganizationUpdateHandler implements ICommandHandler<OrganizationUpdateCommand> {
	private readonly logger = new Logger(OrganizationUpdateHandler.name);

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
		const organization: IOrganization = await this.organizationService.findOneByIdString(id, {
			relations: { contact: true }
		});

		if (!organization) {
			throw new NotFoundException(`Organization with ID ${id} not found.`);
		}

		// Check if attempting to set allowAgentAppExit or allowLogoutFromAgentApp to false
		const errorMsg = validateAgentExitLogoutRestriction(input, {
			regionCode: input.regionCode || organization.regionCode,
			timeZone: input.timeZone || organization.timeZone,
			country: organization.contact?.country
		});

		if (errorMsg) {
			throw new BadRequestException(errorMsg);
		}

		if (
			(input.allowAgentAppExit === false || input.allowLogoutFromAgentApp === false) &&
			input.acknowledgeAgentExitLogoutRestriction
		) {
			const currentUserId = RequestContext.currentUserId();
			this.logger.log(
				`[AGENT_RESTRICTION_ACKNOWLEDGEMENT] Admin User ${currentUserId} explicitly acknowledged legal/compliance risk for setting exit/logout restriction on Organization ID: ${id} at ${new Date().toISOString()}`
			);
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
