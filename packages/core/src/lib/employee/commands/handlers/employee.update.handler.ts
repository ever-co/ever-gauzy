import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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
import {
	assertTrackingSwitchAsSeen,
	callerRoleRank,
	keepsTrackingSwitch,
	mayTurnTrackingOf,
	rankOfRole
} from './../../../time-tracking/timer/tracking-switch-rule';
import { keepingTrackingAtWrite } from './../../tracking-kept-at-write';
import type { JoinTrackingSwitchWrite } from './../../../time-tracking/timer/tracking-switch-as-seen';

/** Whether the save turned the employee's time tracking off: it was on before, and the saved row has it off. */
function turnsTrackingOff(before: IEmployee, saved: IEmployee): boolean {
	const wasTracking = before?.isTrackingEnabled === true;
	const isNowOff = saved?.isTrackingEnabled === false;
	return wasTracking && isNowOff;
}

/**
 * The input with the tracking switch and the work dates, which the bodies of `PUT /employee/:id`,
 * `PUT /employee/:id/profile` and `updateEmployee` carry.
 */
type EmployeeUpdateWithTracking = IEmployeeUpdateInput &
	Partial<Pick<IEmployee, 'isTrackingEnabled' | 'startedWorkOn' | 'endWork'>>;

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

/** Whether two work dates name the same instant; two empty ones do, an empty one and a date do not. */
function isSameWorkDate(sent: Date | string | null | undefined, stored: Date | string | null | undefined): boolean {
	const sentIsEmpty = sent === null || sent === undefined;
	const storedIsEmpty = stored === null || stored === undefined;
	if (sentIsEmpty || storedIsEmpty) {
		return sentIsEmpty && storedIsEmpty;
	}
	return new Date(sent).getTime() === new Date(stored).getTime();
}

/**
 * The tracking the employee subscriber leaves after this write, by the work dates it changes: a start date set to a
 * date, or an end date cleared ("back to work"), turns it on; otherwise an end date set turns it off; otherwise the
 * dates leave it alone (undefined).
 */
function trackingAfterWorkDates(
	startChanged: boolean,
	endChanged: boolean,
	input: EmployeeUpdateWithTracking
): boolean | undefined {
	const startsWork = startChanged && !!input.startedWorkOn;
	const resumesWork = endChanged && input.endWork === null;
	if (startsWork || resumesWork) {
		return true;
	}
	const endsWork = endChanged && !!input.endWork;
	if (endsWork) {
		return false;
	}
	return undefined;
}

/**
 * The input as the caller may save its work dates. The employee subscriber turns the tracking on when a write changes
 * the start date or clears the end date, and off when it sets the end date. Where the organization restricts the
 * switch to higher roles (`restrictTrackingSwitchToHigherRoles`), a date change that would move the tracking is a
 * switch like an explicit `isTrackingEnabled`, so only a caller who may switch this employee's tracking may make it.
 *
 * Anyone else is refused such a change. Work dates sent back as stored are left out of the save: an ORM that does not
 * report which columns a write changes would read a stored start date as a start of work.
 *
 * @param employee The employee as stored, with their organization and their user's role.
 * @param input The changes the save writes.
 * @returns The changes the caller may save.
 * @throws ForbiddenException When the caller may not turn this employee's tracking on or off and the dates would.
 */
function withWorkDatesAllowed(employee: IEmployee, input: EmployeeUpdateWithTracking): EmployeeUpdateWithTracking {
	if (employee?.organization?.restrictTrackingSwitchToHigherRoles !== true) {
		return input;
	}
	const sendsStart = input.startedWorkOn !== undefined;
	const sendsEnd = input.endWork !== undefined;
	if (!sendsStart && !sendsEnd) {
		return input;
	}
	const startChanged = sendsStart && !isSameWorkDate(input.startedWorkOn, employee?.startedWorkOn);
	const endChanged = sendsEnd && !isSameWorkDate(input.endWork, employee?.endWork);
	const trackingAfter = trackingAfterWorkDates(startChanged, endChanged, input);
	const isOn = employee?.isTrackingEnabled === true;
	const movesTracking = trackingAfter !== undefined && trackingAfter !== isOn;
	if (keepsTrackingSwitch(callerRoleRank(), rankOfRole(employee?.user?.role?.name), movesTracking)) {
		return input;
	}
	const changes = { ...input };
	if (sendsStart && !startChanged) {
		delete changes.startedWorkOn;
	}
	if (sendsEnd && !endChanged) {
		delete changes.endWork;
	}
	return changes;
}

/**
 * Whether the caller may turn the employee's time tracking on or off: anyone who may edit the employee, unless their
 * organization restricts the switch to higher roles (`restrictTrackingSwitchToHigherRoles`).
 *
 * @param employee The employee as stored, with their organization and their user's role.
 */
function mayTurnTrackingOfEmployee(employee: IEmployee): boolean {
	if (employee?.organization?.restrictTrackingSwitchToHigherRoles !== true) {
		return true;
	}
	return mayTurnTrackingOf(callerRoleRank(), rankOfRole(employee?.user?.role?.name));
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

		// A save from a screen whose tracking switch is no longer the stored one would act on a state that is gone,
		// for example stop a timer started since: refused before anything is written (ever-co/ever-gauzy#11830)
		assertTrackingSwitchAsSeen(employee?.isTrackingEnabled === true, input.expectedIsTrackingEnabled);

		// Decided before anything is written: a refused switch stops the whole save
		const allowedInput = withWorkDatesAllowed(employee, withTrackingSwitchAllowed(employee, input));

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

		// The acknowledgement and the switch the screen showed are request flags, not employee columns.
		const changes: IEmployeeUpdateInput = { ...allowedInput };
		delete changes.acknowledgeAgentExitLogoutRestriction;
		delete changes.expectedIsTrackingEnabled;

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
		const recordsAcknowledgement = newRestrictions.length > 0;
		const recordAcknowledgement = async (activityLogService: ActivityLogService) => {
			await recordAgentRestrictionAcknowledgement(activityLogService, {
				entity: BaseEntityEnum.Employee,
				entityId: id,
				entityName: employee?.user?.name || employee?.fullName || id,
				organizationId: employee?.organizationId,
				tenantId: employee?.tenantId,
				restricted: newRestrictions
			});
		};

		// The check above answers a screen that was stale already. A switch another admin saves after it is caught by the
		// write: under the switch the screen showed, the employee is compared again under lock in the save's
		// transaction, and the save is made only when the switch is still that one.
		const expected = input.expectedIsTrackingEnabled;
		const saysWhatItSaw = expected !== undefined && expected !== null;

		// Where it is written differs on purpose. A save that says what its screen showed runs in a transaction, and writes
		// the acknowledgement there (below): a 409 from the comparison then records none, and a failed save rolls it back.
		// Any other save runs in no transaction, as before: it writes the acknowledgement first, on its own, so a failed
		// save leaves it. Moving it into the save's write here would change that path, which this guard leaves alone.
		if (recordsAcknowledgement && !saysWhatItSaw) {
			await recordAcknowledgement(this._activityLogService);
		}

		// The check above allowed this caller only dates that leave the tracking as it was read. The subscriber derives
		// the switch when the row is written, later: for this caller it leaves the switch as the row holds it then, so a
		// switch an admin made in between stays. This save then never turns the tracking on or off itself.
		const keepsTracking = !mayTurnTrackingOfEmployee(employee);

		let saved: IEmployee;
		try {
			// Use `create` to save the entity, ensuring ManyToMany relations are persisted
			const save = (service: EmployeeService) => service.create({ ...changes, id });
			// The acknowledgement goes after the comparison, in the save's transaction: a save refused there records none,
			// and it is still written before the save.
			const saveAsSeen = async (service: EmployeeService, join: JoinTrackingSwitchWrite) => {
				if (recordsAcknowledgement) {
					await recordAcknowledgement(join(this._activityLogService));
				}
				return await save(service);
			};
			const write = saysWhatItSaw
				? () => this._employeeService.writeUnderTrackingSwitchAsSeen(id, expected, saveAsSeen)
				: () => save(this._employeeService);
			saved = keepsTracking ? await keepingTrackingAtWrite(id, write) : await write();
		} catch (error) {
			// Handle any errors during the update process
			if (
				error instanceof BadRequestException ||
				error instanceof ForbiddenException ||
				error instanceof ConflictException
			) {
				throw error;
			}
			throw new BadRequestException(error.message || 'Failed to update employee profile.');
		}

		if (keepsStoredRates) {
			const persisted = await this._employeeService.findOneByIdString(id);
			saved = withStoredOwnRates(saved, persisted);
		}

		// A saved "off" this save did not write is someone else's switch, whose own save published its stop
		if (!keepsTracking && turnsTrackingOff(employee, saved)) {
			// The read above loads the organization, whose id MikroORM leaves off the column
			const organizationId = employee.organizationId ?? employee.organization?.id;
			const tenantId = employee.tenantId ?? RequestContext.currentTenantId();
			this._eventBus.publish(new TrackingTurnedOffEvent({ employeeId: id, organizationId, tenantId }));
		}
		return saved;
	}
}
