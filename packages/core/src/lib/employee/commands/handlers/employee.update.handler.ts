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
import { assertOwnRatesMayChange, isSameId, removeOwnRateFields, withStoredOwnRates } from './../../own-rates';
import { TrackingTurnedOffEvent } from './../../../time-tracking/timer/events/tracking-turned-off.event';
import { callerRoleRank, keepsTrackingSwitch, rankOfRole } from './../../../time-tracking/timer/tracking-switch-rule';

/** Whether the save turned the employee's time tracking off: it was on before, and the saved row has it off. */
function turnsTrackingOff(before: IEmployee, saved: IEmployee): boolean {
	const wasTracking = before?.isTrackingEnabled === true;
	const isNowOff = saved?.isTrackingEnabled === false;
	return wasTracking && isNowOff;
}

/** The input with the tracking switch, which the bodies of `PUT /employee/:id` and `updateEmployee` carry. */
type EmployeeUpdateWithTracking = IEmployeeUpdateInput & Partial<Pick<IEmployee, 'isTrackingEnabled'>>;

/**
 * The input as the caller may save it. Where the employee's organization restricts the switch to higher roles
 * (`restrictTrackingSwitchToHigherRoles`), the employee's time tracking switch is the caller's to write only when
 * their role is above the employee's: an admin acts on anyone, admins included; a MANAGER on the other roles only;
 * anyone else on no one. This switch counts in every team of the organization, so only the tenant roles rank here.
 * Elsewhere, the default, whoever may edit the employee writes it, as before.
 *
 * Anyone else is refused a change of the switch. When they send it back as stored, as edit forms do, it is left out of
 * the save: it was read before, and an admin may have changed it since, which that copy would overwrite.
 *
 * @param employee The employee as stored, with their organization and their user's role.
 * @param input The changes the save writes.
 * @returns The changes the caller may save.
 * @throws ForbiddenException When the caller may not turn this employee's tracking on or off and the save would.
 */
function withTrackingSwitchAllowed(employee: IEmployee, input: EmployeeUpdateWithTracking): EmployeeUpdateWithTracking {
	if (input.isTrackingEnabled === undefined) {
		return input;
	}
	if (employee?.organization?.restrictTrackingSwitchToHigherRoles !== true) {
		return input;
	}
	// Anything but true reads as off, as the timer reads it
	const turnsOn = input.isTrackingEnabled === true;
	const isOn = employee?.isTrackingEnabled === true;
	if (keepsTrackingSwitch(callerRoleRank(), rankOfRole(employee?.user?.role?.name), turnsOn !== isOn)) {
		return input;
	}
	const changes = { ...input };
	delete changes.isTrackingEnabled;
	return changes;
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
			relations: { organization: { contact: true }, user: { role: true }, contact: true }
		});

		// Decided before anything is written: a refused switch stops the whole save
		const allowedInput = withTrackingSwitchAllowed(employee, input);

		const editsOwnRecord = isSameId(user?.employeeId, id);
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
		const changes: IEmployeeUpdateInput = { ...allowedInput };
		delete changes.acknowledgeAgentExitLogoutRestriction;

		const keepsStoredRates = editsOwnRecord && !changesOwnRates;
		if (keepsStoredRates) {
			removeOwnRateFields(changes);
		}

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

		if (keepsStoredRates) {
			const persisted = await this._employeeService.findOneByIdString(id);
			saved = withStoredOwnRates(saved, persisted);
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
