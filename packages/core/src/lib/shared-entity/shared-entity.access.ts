import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntityMetadata } from 'typeorm';
import { ID, IShareRule, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { assertSensitiveRelationsAllowed } from '../core/util/sensitive-relations.helper';
import { ManagedEmployeeService } from '../employee/managed-employee.service';
import { canViewTrackedData } from '../shared/guards/employee-tracked-data.guard';
import { buildSharedEntityRelations } from './shared-entity.helper';

/**
 * The permissions (any one) the read routes of these types require. Anyone holding a share's link reads
 * what it names without signing in, so its author must be allowed to read it. Equipment is not listed:
 * its read routes are open to every member.
 */
const SHARED_RECORD_READ_PERMISSIONS: Readonly<Record<string, PermissionsEnum[]>> = {
	Invoice: [PermissionsEnum.INVOICES_VIEW],
	Expense: [PermissionsEnum.ORG_EXPENSES_VIEW],
	Income: [PermissionsEnum.ORG_INCOMES_VIEW],
	// GET /payments/:id and the `payment` query are gated by ORG_PAYMENT_ADD_EDIT.
	Payment: [PermissionsEnum.ORG_PAYMENT_VIEW, PermissionsEnum.ORG_PAYMENT_ADD_EDIT],
	Proposal: [PermissionsEnum.ORG_PROPOSALS_VIEW],
	Product: [PermissionsEnum.ORG_INVENTORY_VIEW],
	Candidate: [PermissionsEnum.ORG_CANDIDATES_VIEW]
};

/**
 * The permissions (any one) the read routes of these types require, checked on the shared record only:
 * its relations keep the checks below, so a caller who may read a task can still share it with its members.
 */
const SHARED_ROOT_READ_PERMISSIONS: Readonly<Record<string, PermissionsEnum[]>> = {
	Task: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW],
	OrganizationTeam: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW],
	OrganizationProject: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW]
};

/**
 * Types that hold one employee's tracked data. GraphQL takes any entity name, so they can be a share's
 * record. A screenshot or a minute belongs to the employee of its time slot.
 */
const TRACKED_DATA_TYPES: ReadonlySet<string> = new Set([
	'TimeLog',
	'TimeSlot',
	'TimeSlotMinute',
	'TimeSlotSession',
	'Screenshot',
	'Activity'
]);

/**
 * The recordings of the media plugins (videos, camshots, soundshots), registered when those plugins are on.
 * They name the employee who uploaded them (`uploadedById`), not an `employeeId`, and their read routes
 * serve a recording to that employee or to a CHANGE_SELECTED_EMPLOYEE holder only (`assertCallerOwnsUpload`).
 */
const UPLOADED_TRACKED_DATA_TYPES: ReadonlySet<string> = new Set(['Video', 'Camshot', 'Soundshot']);

/**
 * Whether the caller may read the shared record, as the read routes of its type decide.
 *
 * @param name - The entity name, from the metadata (never the client's string).
 * @param record - The shared record.
 * @returns `undefined` for a type without a rule here.
 */
function mayReadSharedRecord(name: string, record: Record<string, unknown> | null): boolean | undefined {
	if (name === 'Employee') {
		// Without CHANGE_SELECTED_EMPLOYEE, GET /employee/:id serves the caller's own record only.
		const ownEmployeeId = RequestContext.currentUser()?.employeeId;
		return (
			RequestContext.hasAnyPermission([
				PermissionsEnum.ORG_EMPLOYEES_VIEW,
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			]) ||
			(!!ownEmployeeId && record?.['id'] === ownEmployeeId)
		);
	}
	if (name === 'User') {
		const ownUserId = RequestContext.currentUserId();
		return (
			RequestContext.hasPermission(PermissionsEnum.ORG_USERS_VIEW) ||
			(!!ownUserId && record?.['id'] === ownUserId)
		);
	}
	const permissions = SHARED_RECORD_READ_PERMISSIONS[name];
	if (!permissions) {
		return undefined;
	}
	// The estimate pages read an estimate, which is an invoice row, with ESTIMATES_VIEW.
	return RequestContext.hasAnyPermission(
		name === 'Invoice' && record?.['isEstimate'] ? [...permissions, PermissionsEnum.ESTIMATES_VIEW] : permissions
	);
}

/**
 * Whether the caller may read a task, team, project or tracked-data record, as its read routes decide.
 * Unlike {@link mayReadSharedRecord}, a yes says nothing about the record's relations.
 *
 * @param dataSource - Where the time slot of a screenshot or a minute, and the organization's tracked-data
 * setting, are looked up.
 * @param managedEmployeeService - Which employees the caller manages.
 * @param name - The entity name, from the metadata.
 * @param record - The shared record.
 * @returns `undefined` for a type without a rule here.
 */
async function mayReadSharedRoot(
	dataSource: DataSource,
	managedEmployeeService: ManagedEmployeeService,
	name: string,
	record: Record<string, unknown> | null
): Promise<boolean | undefined> {
	const permissions = SHARED_ROOT_READ_PERMISSIONS[name];
	if (permissions) {
		if (RequestContext.hasAnyPermission(permissions)) {
			return true;
		}
		// GET /organization-projects/:id also serves the project's managers (ProjectManagerOrPermissionGuard).
		const employeeId = RequestContext.currentEmployeeId();
		if (name !== 'OrganizationProject' || !employeeId || !record?.['id']) {
			return false;
		}
		return await managedEmployeeService.isManagerOfTeamsOrProjects(employeeId, [], [record['id'] as ID]);
	}
	if (UPLOADED_TRACKED_DATA_TYPES.has(name)) {
		const currentEmployeeId = RequestContext.currentEmployeeId();
		const ownsUpload =
			RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) ||
			(!!currentEmployeeId && record?.['uploadedById'] === currentEmployeeId);
		// Their read routes also state EmployeeTrackedDataGuard.
		return ownsUpload && (await canViewTrackedData(dataSource, [record?.['organizationId']]));
	}
	if (!TRACKED_DATA_TYPES.has(name)) {
		return undefined;
	}
	let employeeId = record?.['employeeId'] as ID | undefined;
	let organizationId = record?.['organizationId'] as ID | undefined;
	// An undefined key would be dropped from the lookup, so it needs the slot's tenant too.
	if (!employeeId && record?.['timeSlotId'] && record['tenantId']) {
		const timeSlot = await dataSource.getRepository('TimeSlot').findOne({
			where: { id: record['timeSlotId'] as ID, tenantId: record['tenantId'] as ID },
			select: { id: true, employeeId: true, organizationId: true }
		});
		employeeId = timeSlot?.['employeeId'];
		organizationId = timeSlot?.['organizationId'] ?? organizationId;
	}
	// The read routes serve the caller's own rows, every row with CHANGE_SELECTED_EMPLOYEE, and a team
	// manager's members' rows through the time log list — and only while the organization's
	// `allowEmployeeToSeeTrackedData` lets the caller see tracked data (EmployeeTrackedDataGuard).
	return (
		(await managedEmployeeService.canManageEmployee(employeeId, undefined, organizationId)) &&
		(await canViewTrackedData(dataSource, [organizationId]))
	);
}

/**
 * Refuses a relation into a type of {@link SHARED_RECORD_READ_PERMISSIONS} the caller may not read, unless
 * it comes with a record they may read: the read route of that record returns its own relations and those
 * of its one-to-many children with it (an invoice's payments, the expense on one of its items).
 *
 * @param metadata - Metadata of the entity the rules apply to.
 * @param rules - The rules, already validated by `assertShareRulesAreSafe`.
 * @param withReadableRecord - Whether the rules hang off a record the caller may read.
 */
function assertSharedRelationsReadable(metadata: EntityMetadata, rules: IShareRule, withReadableRecord: boolean): void {
	if (!rules.relations || typeof rules.relations !== 'object') {
		return;
	}
	for (const [relationName, subRules] of Object.entries(rules.relations)) {
		const relation = metadata.findRelationWithPropertyPath(relationName);
		if (!relation) {
			continue;
		}
		const target = relation.inverseEntityMetadata;
		const permissions = SHARED_RECORD_READ_PERMISSIONS[target.name];
		if (permissions && !withReadableRecord && !RequestContext.hasAnyPermission(permissions)) {
			throw new ForbiddenException(
				`Relation "${relationName}" (${target.name}) cannot be shared without permission to read it`
			);
		}
		assertSharedRelationsReadable(target, subRules, !!permissions || (withReadableRecord && relation.isOneToMany));
	}
}

/**
 * Refuses a share whose author may not read what it publishes: the record it points at, or a relation
 * its rules add.
 *
 * @param metadata - Metadata of the shared record's entity.
 * @param record - The shared record.
 * @param rules - The share rules, already validated by `assertShareRulesAreSafe`.
 * @param dataSource - The data source the shared record was read from.
 * @param managedEmployeeService - Which employees the caller manages.
 * @throws ForbiddenException when the caller lacks a permission the share needs.
 */
export async function assertCallerMayShare(
	metadata: EntityMetadata,
	record: Record<string, unknown> | null,
	rules: IShareRule,
	dataSource: DataSource,
	managedEmployeeService: ManagedEmployeeService
): Promise<void> {
	// Without a request there is no caller to check, as for the sensitive relations below.
	if (!RequestContext.currentRequestContext()) {
		return;
	}
	const readable = mayReadSharedRecord(metadata.name, record);
	if (
		readable === false ||
		(await mayReadSharedRoot(dataSource, managedEmployeeService, metadata.name, record)) === false
	) {
		throw new ForbiddenException(`Cannot share this ${metadata.name}: you are not allowed to read it`);
	}
	// The same gate a read of the record through its own routes applies to these relations.
	assertSensitiveRelationsAllowed(metadata, buildSharedEntityRelations(rules));
	assertSharedRelationsReadable(metadata, rules, readable === true);
}

/**
 * Whether `next` shares nothing that `current` does not already share: no other field, no other relation.
 *
 * @param next - The submitted rules, already validated.
 * @param current - The stored rules.
 */
export function isWithinShareRules(next: IShareRule, current: unknown): boolean {
	if (!current || typeof current !== 'object') {
		return false;
	}
	const { fields, relations } = current as IShareRule;
	if (!Array.isArray(fields) || !next.fields.every((field: string) => fields.includes(field))) {
		return false;
	}
	const nextRelations: Record<string, IShareRule> =
		next.relations && typeof next.relations === 'object' ? next.relations : {};
	const currentRelations: Record<string, IShareRule> = relations && typeof relations === 'object' ? relations : {};
	return Object.entries(nextRelations).every(
		([name, subRules]) =>
			Object.prototype.hasOwnProperty.call(currentRelations, name) &&
			isWithinShareRules(subRules, currentRelations[name])
	);
}
