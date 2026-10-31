import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
	BaseEntityEnum,
	checkAgentExitLogoutRestrictionChange,
	IAgentRestrictionLocation,
	ID,
	IOrganization,
	IOrganizationUpdateInput,
	isEEAOrUKLocation
} from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { ActivityLogService } from '../../../activity-log/activity-log.service';
import { ContactService } from '../../../contact/contact.service';
import { EmployeeService } from '../../../employee/employee.service';
import {
	liftEmployeeAgentRestrictions,
	recordAgentRestrictionAcknowledgement
} from '../../../employee/agent-exit-logout-restriction';
import { OrganizationService } from '../../organization.service';
import { organizationLocations, storedOrganizationLocation } from '../../organization-location';
import {
	logScreenshotCaptureAcknowledgement,
	omitScreenshotCaptureAcknowledgementFields,
	resolveScreenshotCaptureAcknowledgement
} from '../../screenshot-capture-acknowledgement';
import { OrganizationUpdateCommand } from '../organization.update.command';

@CommandHandler(OrganizationUpdateCommand)
export class OrganizationUpdateHandler implements ICommandHandler<OrganizationUpdateCommand> {
	private readonly logger = new Logger(OrganizationUpdateHandler.name);

	constructor(
		private readonly organizationService: OrganizationService,
		private readonly activityLogService: ActivityLogService,
		private readonly moduleRef: ModuleRef,
		private readonly contactService: ContactService
	) {}

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
		// Issue #9872: the screen capture acknowledgement is request-only too, and its record is the server's.
		const changes: IOrganizationUpdateInput = omitScreenshotCaptureAcknowledgementFields(input);
		delete changes.acknowledgeAgentExitLogoutRestriction;
		// The location is judged from what is stored and what this write stores (see `organizationLocations`): the
		// region code, the time zone and the country of the contact the organization is linked to. Neither a top-level
		// `country` nor the fields of a contact the request carries are stored by the save, so they move nothing.
		// The exit/logout rule judges the location after the write only.
		const {
			stored: previousLocation,
			after: location,
			requested,
			unreadContactId
		} = await organizationLocations(organization, changes, this.contactService);
		// Without the contact the save links, the location after the write is unknown: nothing is judged or saved.
		if (unreadContactId) {
			throw new NotFoundException(`Contact with ID ${unreadContactId} not found.`);
		}
		const { error: restrictionError, newRestrictions } = checkAgentExitLogoutRestrictionChange(
			input,
			organization,
			location,
			previousLocation
		);
		if (restrictionError) {
			throw new BadRequestException(restrictionError);
		}

		// Issue #9872: turning screen capture on for an EEA/UK organization takes the admin's acknowledgement,
		// stored with the change below. Re-saving an organization that already captures, or turning capture
		// off, asks nothing, so existing organizations keep their value without a new step. It asks if the
		// organization is in the EEA/UK before or after the write, or by any location value the request names.
		const screenshotCaptureAcknowledgement = resolveScreenshotCaptureAcknowledgement(input, organization, [
			previousLocation,
			location,
			...requested
		]);
		input = changes;

		// Written and awaited before the save: no restriction without its recorded acknowledgement.
		if (newRestrictions.length > 0) {
			await recordAgentRestrictionAcknowledgement(this.activityLogService, {
				entity: BaseEntityEnum.Organization,
				entityId: id,
				entityName: organization.name,
				organizationId: id,
				tenantId: organization.tenantId,
				restricted: newRestrictions
			});
		}

		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		// If any organization is set as default, update others to non-default
		if (input.isDefault) {
			await this.organizationService.update({ tenantId }, { isDefault: false });
		}

		// Simplify boolean assignments and handle optional fields like standardWorkHoursPerDay.
		// Only the flags the input carries are written: a partial update (e.g. only the name) used to turn
		// every unsent "show_*" flag back to its default.
		const has = (key: keyof IOrganizationUpdateInput) => input[key] !== undefined;
		const updateData: Partial<IOrganizationUpdateInput> = {
			...input,
			...(has('show_profits') && { show_profits: !!input.show_profits }),
			...(has('show_bonuses_paid') && { show_bonuses_paid: !!input.show_bonuses_paid }),
			...(has('show_income') && { show_income: !!input.show_income }),
			...(has('show_total_hours') && { show_total_hours: !!input.show_total_hours }),
			...(has('show_projects_count') && { show_projects_count: input.show_projects_count !== false }),
			...(has('show_minimum_project_size') && {
				show_minimum_project_size: input.show_minimum_project_size !== false
			}),
			...(has('show_clients_count') && { show_clients_count: input.show_clients_count !== false }),
			...(has('show_clients') && { show_clients: input.show_clients !== false }),
			...(has('show_employees_count') && { show_employees_count: input.show_employees_count !== false }),
			...(input.standardWorkHoursPerDay !== undefined && {
				standardWorkHoursPerDay: input.standardWorkHoursPerDay
			}),
			...screenshotCaptureAcknowledgement
		};
		// Issue #9872: the flag is written only when this request changes it from the row read above. Sending the
		// stored value back writes nothing, so a save that raced one turning capture off cannot turn it back on
		// without an acknowledgement: every write of `true` went through the check above.
		if (updateData.allowScreenshotCapture === organization.allowScreenshotCapture) {
			delete updateData.allowScreenshotCapture;
		}

		// Creates a new organization or updates an existing one based on the provided data.
		await this.organizationService.create({ ...updateData, id });

		if (screenshotCaptureAcknowledgement) {
			await logScreenshotCaptureAcknowledgement(
				this.activityLogService,
				organization,
				screenshotCaptureAcknowledgement
			);
		}

		// Moving into the EEA/UK makes every employee of this organization an EEA/UK worker. Confirmed on the row as
		// saved, read back only when the write may have moved the organization.
		if (
			!isEEAOrUKLocation(previousLocation) &&
			isEEAOrUKLocation([location, ...requested]) &&
			isEEAOrUKLocation(await this.savedLocation(id))
		) {
			try {
				await liftEmployeeAgentRestrictions(
					this.moduleRef.get(EmployeeService, { strict: false }),
					this.activityLogService,
					{ tenantId: organization.tenantId, organizationId: id },
					`organization ${id} moved into the EEA/UK`
				);
			} catch (error) {
				this.logger.error(`Could not lift agent exit/logout restrictions for organization ${id}: ${error?.message}`);
			}
		}

		// Return the updated organization entity
		return await this.organizationService.findOneByIdString(id);
	}

	/**
	 * Where the organization is as saved: read back after the save, with its contact.
	 *
	 * @param id The organization.
	 */
	private async savedLocation(id: ID): Promise<IAgentRestrictionLocation> {
		const saved = await this.organizationService.findOneByIdString(id, { relations: { contact: true } });
		return storedOrganizationLocation(saved);
	}
}
