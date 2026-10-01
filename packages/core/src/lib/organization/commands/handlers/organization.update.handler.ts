import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
	BaseEntityEnum,
	checkAgentExitLogoutRestrictionChange,
	ID,
	IOrganization,
	IOrganizationUpdateInput
} from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { recordAgentRestrictionAcknowledgement } from '../../../activity-log/agent-restriction-acknowledgement';
import { OrganizationService } from '../../organization.service';
import { OrganizationUpdateCommand } from '../organization.update.command';

@CommandHandler(OrganizationUpdateCommand)
export class OrganizationUpdateHandler implements ICommandHandler<OrganizationUpdateCommand> {
	constructor(private readonly organizationService: OrganizationService, private readonly eventBus: EventBus) {}

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

		// Issue #9873: EEA/UK organizations may not stop workers exiting or logging out of the agent;
		// elsewhere doing so requires an explicit acknowledgement, recorded against the admin.
		// The acknowledgement is a request flag, not an organization column.
		const changes: IOrganizationUpdateInput = { ...input };
		delete changes.acknowledgeAgentExitLogoutRestriction;
		const previousLocation = {
			regionCode: organization.regionCode,
			timeZone: organization.timeZone,
			country: organization.contact?.country
		};
		const location = {
			regionCode: changes.regionCode !== undefined ? changes.regionCode : previousLocation.regionCode,
			timeZone: changes.timeZone !== undefined ? changes.timeZone : previousLocation.timeZone,
			country: changes.country || previousLocation.country
		};
		const { error: restrictionError, newRestrictions } = checkAgentExitLogoutRestrictionChange(
			input,
			organization,
			location,
			previousLocation
		);
		if (restrictionError) {
			throw new BadRequestException(restrictionError);
		}
		input = changes;

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

		if (newRestrictions.length > 0) {
			recordAgentRestrictionAcknowledgement(this.eventBus, {
				entity: BaseEntityEnum.Organization,
				entityId: id,
				entityName: organization.name,
				organizationId: id,
				tenantId: organization.tenantId,
				restricted: newRestrictions
			});
		}

		// Return the updated organization entity
		return await this.organizationService.findOneByIdString(id);
	}
}
