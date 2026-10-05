import { BadRequestException, Logger } from '@nestjs/common';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	AGENT_EXIT_LOGOUT_FIELDS,
	AGENT_RESTRICTION_ON_CREATE_ERR_MSG,
	AgentExitLogoutField,
	BaseEntityEnum,
	getNewAgentExitLogoutRestrictions,
	IAgentExitLogoutSettings,
	IAgentRestrictionLocation,
	IContact,
	ID,
	IEmployee
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import type { ActivityLogService } from '../activity-log/activity-log.service';
import type { EmployeeService } from './employee.service';

/**
 * Issue #9873 — stopping a monitored worker from exiting or logging out of the desktop agent.
 * Shared by the organization, employee and user handlers that can create or change it.
 */

const logger = new Logger('AgentExitLogoutRestriction');

/**
 * Where an employee is, as two locations: their own (contact, user time zone) and their
 * organization's. EEA/UK if EITHER is, so one cannot mask the other.
 *
 * @param employee the stored employee, with `user`, `contact` and `organization.contact` loaded
 * @param contact contact fields arriving with the update, which win over the stored ones
 */
export function employeeAgentRestrictionLocations(
	employee: IEmployee,
	contact?: Partial<IContact>
): IAgentRestrictionLocation[] {
	return [
		{
			country: contact?.country || employee?.contact?.country,
			regionCode: contact?.regionCode || employee?.contact?.regionCode,
			timeZone: employee?.user?.timeZone
		},
		{
			country: employee?.organization?.contact?.country,
			regionCode: employee?.organization?.regionCode,
			timeZone: employee?.organization?.timeZone
		}
	];
}

/**
 * A new organization or employee cannot start out restricted: the restriction needs an
 * acknowledgement recorded against an existing record, so it is set afterwards through an update.
 */
export function assertNoAgentRestrictionOnCreate(input: object): void {
	if (getNewAgentExitLogoutRestrictions(input as IAgentExitLogoutSettings).length > 0) {
		throw new BadRequestException(AGENT_RESTRICTION_ON_CREATE_ERR_MSG);
	}
}

/**
 * Records, against the acting admin, that they explicitly accepted the legal risk of the restriction.
 *
 * Awaited, and called BEFORE the restriction is saved: if the record cannot be written the update
 * fails, so a restriction never exists without its acknowledgement. The admin's ID is stored in
 * `data` as well as `createdByUserId`.
 */
export async function recordAgentRestrictionAcknowledgement(
	activityLogService: ActivityLogService,
	params: {
		entity: BaseEntityEnum.Organization | BaseEntityEnum.Employee;
		entityId: ID;
		entityName: string;
		organizationId: ID;
		tenantId: ID;
		restricted: AgentExitLogoutField[];
	}
): Promise<void> {
	const { entity, entityId, entityName, organizationId, tenantId, restricted } = params;
	const acknowledgedByUserId = RequestContext.currentUserId();
	const acknowledgedAt = new Date().toISOString();

	await activityLogService.create({
		entity,
		entityId,
		action: ActionTypeEnum.Updated,
		actorType: ActorTypeEnum.User,
		description: `${entityName}: exit/logout restriction acknowledged (${restricted.join(', ')})`,
		updatedFields: restricted,
		data: { agentExitLogoutRestrictionAcknowledgement: { acknowledgedByUserId, acknowledgedAt, restricted } },
		organizationId,
		tenantId
	});

	logger.log(
		`[AGENT_RESTRICTION_ACKNOWLEDGEMENT] User ${acknowledgedByUserId} acknowledged restricting ${restricted.join(
			', '
		)} on ${entity} ${entityId} (tenant ${tenantId}) at ${acknowledgedAt}`
	);
}

/**
 * When an organization or a worker moves INTO the EEA/UK, lifts the exit/logout restriction of the
 * employees concerned and records each lift. A move is a deliberate change made by a person, so this
 * is not the silent migration #9873 rules out (restrictions that were already in place in EEA/UK
 * are left for review by the `ReportRestrictedAgentSettings` migration).
 *
 * @returns how many employees were lifted
 */
export async function liftEmployeeAgentRestrictions(
	employeeService: EmployeeService,
	activityLogService: ActivityLogService,
	where: { tenantId: ID; organizationId?: ID; userId?: ID },
	reason: string
): Promise<number> {
	const restricted = new Map<ID, IEmployee>();
	for (const restriction of [{ allowAgentAppExit: false }, { allowLogoutFromAgentApp: false }]) {
		const employees = await employeeService.find({ where: { ...where, ...restriction } });
		for (const employee of employees) restricted.set(employee.id, employee);
	}

	for (const employee of restricted.values()) {
		const lifted = AGENT_EXIT_LOGOUT_FIELDS.filter((field) => employee[field] === false);
		await employeeService.update(employee.id, { allowAgentAppExit: true, allowLogoutFromAgentApp: true });
		await activityLogService.create({
			entity: BaseEntityEnum.Employee,
			entityId: employee.id,
			action: ActionTypeEnum.Updated,
			actorType: ActorTypeEnum.System,
			description: `Exit/logout restriction lifted (${lifted.join(', ')}): ${reason}`,
			updatedFields: lifted,
			data: {
				agentExitLogoutRestrictionLifted: {
					reason,
					lifted,
					triggeredByUserId: RequestContext.currentUserId(),
					liftedAt: new Date().toISOString()
				}
			},
			organizationId: employee.organizationId,
			tenantId: employee.tenantId
		});
		logger.log(`[AGENT_RESTRICTION_LIFTED] Employee ${employee.id} (tenant ${employee.tenantId}): ${reason}`);
	}

	return restricted.size;
}
