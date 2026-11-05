import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
	BaseEntityEnum,
	checkAgentExitLogoutRestrictionChange,
	IEmployee,
	IEmployeeUpdateInput,
	PermissionsEnum
} from '@gauzy/contracts';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeService } from './../../employee.service';
import { RequestContext } from './../../../core/context';
import { ActivityLogService } from './../../../activity-log/activity-log.service';
import { ownContactPatch } from './../../../contact/profile-contact.helper';
import {
	employeeAgentRestrictionLocations,
	recordAgentRestrictionAcknowledgement
} from './../../agent-exit-logout-restriction';
import { assertOwnRatesMayChange } from './../../own-rates';
import { TrackingTurnedOffEvent } from './../../../time-tracking/timer/events/tracking-turned-off.event';

/** Whether the save turned the employee's time tracking off: it was on before, and the saved row has it off. */
function turnsTrackingOff(before: IEmployee, saved: IEmployee): boolean {
	const wasTracking = before?.isTrackingEnabled === true;
	const isNowOff = saved?.isTrackingEnabled === false;
	return wasTracking && isNowOff;
}

@CommandHandler(EmployeeUpdateCommand)
export class EmployeeUpdateHandler implements ICommandHandler<EmployeeUpdateCommand> {
	constructor(
		private readonly _employeeService: EmployeeService,
		private readonly _activityLogService: ActivityLogService,
		private readonly _eventBus: EventBus
	) {}

	/**
	 * Handles the execution of the `EmployeeUpdateCommand`.
	 * Ensures proper permissions are enforced and updates the employee's profile.
	 *
	 * @param command - The `EmployeeUpdateCommand` containing the employee ID and input data.
	 * @returns The updated employee entity.
	 * @throws ForbiddenException if the user lacks permissions or tries to edit another employee's profile.
	 * @throws BadRequestException if the update operation fails.
	 */
	public async execute(command: EmployeeUpdateCommand): Promise<IEmployee> {
		const { id, input } = command;
		const user = RequestContext.currentUser();

		/**
		 * If user/employee has only own profile edit permission
		 */
		if (
			RequestContext.hasPermission(PermissionsEnum.PROFILE_EDIT) &&
			!RequestContext.hasPermission(PermissionsEnum.ORG_EMPLOYEES_EDIT)
		) {
			if (user.employeeId !== id) {
				throw new ForbiddenException('Failed to update employee profile.');
			}
		}

		// Issue #9873: in EEA/UK a worker must always be able to exit and log out of the agent;
		// elsewhere restricting either requires an explicit acknowledgement, recorded against the admin.
		const employee: IEmployee = await this._employeeService.findOneByIdString(id, {
			relations: { organization: { contact: true }, user: true, contact: true }
		});

		const editsOwnRecord = user?.employeeId === id;
		const changesOwnRates = RequestContext.hasPermission(PermissionsEnum.CHANGE_OWN_RATES);
		assertOwnRatesMayChange(employee, input, { editsOwnRecord, changesOwnRates });
		// The worker's own location and their organization's: EEA/UK if either is.
		const previousLocation = employeeAgentRestrictionLocations(employee);
		const location = employeeAgentRestrictionLocations(employee, input.contact);
		const { error: restrictionError, newRestrictions } = checkAgentExitLogoutRestrictionChange(
			input,
			employee,
			location,
			previousLocation
		);
		if (restrictionError) {
			throw new BadRequestException(restrictionError);
		}

		// The acknowledgement is a request flag, not an employee column.
		const changes: IEmployeeUpdateInput = { ...input };
		delete changes.acknowledgeAgentExitLogoutRestriction;

		// The edit writes the employee's own contact and never another one. `contact` cascades by id, and a
		// nested id used to re-point the employee at an organization's, a client's or a candidate's contact
		// and overwrite it. Only the stored `contactId` is kept as an id, and the contact carries the
		// employee's tenant and organization. The contact link itself is never the edit's to move.
		delete (changes as { contactId?: unknown }).contactId;
		if (changes.contact) {
			// The read above loads the contact and the organization, whose ids MikroORM leaves off the columns; the
			// employee is read inside the caller's tenant, which is the tenant its contact is stamped with.
			changes.contact = ownContactPatch(
				{ ...employee, tenantId: employee.tenantId ?? RequestContext.currentTenantId() },
				changes.contact
			);
		}

		// An external id the request leaves out keeps its stored value, and one sent empty is cleared.
		// The key is dropped rather than left undefined, because the MikroORM assign copies undefined onto the row.
		for (const key of ['upworkId', 'linkedInId'] as const) {
			if (changes[key] === undefined) {
				delete changes[key];
			} else {
				changes[key] = changes[key] || null;
			}
		}

		// Written and awaited before the save: no restriction without its recorded acknowledgement.
		if (newRestrictions.length > 0) {
			await recordAgentRestrictionAcknowledgement(this._activityLogService, {
				entity: BaseEntityEnum.Employee,
				entityId: id,
				entityName: employee?.user?.name || employee?.fullName || id,
				organizationId: employee?.organizationId,
				tenantId: employee?.tenantId,
				restricted: newRestrictions
			});
		}

		let saved: IEmployee;
		try {
			// Use `create` to save the entity, ensuring ManyToMany relations are persisted
			saved = await this._employeeService.create({
				...changes,
				id
			});
		} catch (error) {
			// Handle any errors during the update process
			if (error instanceof BadRequestException || error instanceof ForbiddenException) {
				throw error;
			}
			throw new BadRequestException(error.message || 'Failed to update employee profile.');
		}

		if (turnsTrackingOff(employee, saved)) {
			// The read above loads the organization, whose id MikroORM leaves off the column
			const organizationId = employee.organizationId ?? employee.organization?.id;
			const tenantId = employee.tenantId ?? RequestContext.currentTenantId();
			this._eventBus.publish(new TrackingTurnedOffEvent({ employeeId: id, organizationId, tenantId }));
		}
		return saved;
	}
}
