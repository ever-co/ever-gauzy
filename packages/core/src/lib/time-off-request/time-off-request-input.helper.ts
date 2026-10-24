import { ForbiddenException } from '@nestjs/common';
import { ID, PermissionsEnum, StatusTypesEnum } from '@gauzy/contracts';

/**
 * What a `POST /time-off-request` or `PUT /time-off-request/:id` body (and the GraphQL `createTimeOffRequest` /
 * `updateTimeOffRequest` input) may write.
 *
 * The two writes used to store the body as given — `Object.assign(new TimeOffRequest(), body)` on create, the body
 * spread over the path id on update — with no whitelist DTO. A caller holding `TIME_OFF_ADD` or `TIME_OFF_DELETE`
 * could therefore file leave already `APPROVED`, or approve it by editing it, skipping the
 * `@Roles(SUPER_ADMIN, ADMIN)` approve/deny routes, and file it for any colleague through `employees`.
 *
 * - **status** is never read from the body. A new request is `REQUESTED`, or `APPROVED` when the policy it is filed
 *   under — read from the store, in the caller's tenant and organization — does not require approval: the rule the
 *   request and holiday dialogs apply in the browser, now applied where the browser cannot choose. An edit keeps
 *   the stored status; status changes go through the approve and deny routes.
 * - **employees**: a caller who may act for other employees (`CHANGE_SELECTED_EMPLOYEE`, or the route's
 *   organization-wide `ALL_ORG_EDIT`) files for the employees it names, as the admin's request and holiday dialogs
 *   do. Anyone else files for themselves, whatever the body says, and keeps the stored employees on an edit.
 * - every other member is copied by name; members the write does not list (the tenant and organization of an
 *   edited row, its id, audit columns, nested relation objects) are not written from the body.
 *
 * Free of entity imports so it can be unit-tested on plain objects.
 */

/** The grants that let a caller name other employees on a time-off request. */
export const TIME_OFF_FOR_OTHERS_PERMISSIONS: ReadonlyArray<PermissionsEnum> = Object.freeze([
	PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
	PermissionsEnum.ALL_ORG_EDIT
]);

/** The body members of a time-off write, as the browser and the GraphQL input send them. */
export interface ITimeOffWriteBody {
	description?: string;
	start?: Date | string;
	end?: Date | string;
	requestDate?: Date | string;
	isHoliday?: boolean;
	documentUrl?: string | null;
	documentId?: ID | null;
	policyId?: ID | null;
	policy?: { id?: ID } | null;
	employees?: Array<{ id?: ID } | null> | null;
	organizationId?: ID;
	isActive?: boolean;
	isArchived?: boolean;
	archivedAt?: Date | string | null;
	[member: string]: unknown;
}

/** The members a write stores, in the relation shape both ORMs persist. */
export interface ITimeOffWriteMembers {
	description?: string;
	start?: Date | string;
	end?: Date | string;
	requestDate?: Date | string;
	isHoliday?: boolean;
	documentUrl?: string | null;
	document?: { id: ID } | null;
	policy?: { id: ID };
	organizationId?: ID;
	isActive?: boolean;
	isArchived?: boolean;
	archivedAt?: Date | string | null;
}

/**
 * The status a new time-off request is filed with.
 *
 * @param requiresApproval The stored policy's `requiresApproval`, or undefined when the request names no policy of
 *                         the caller's organization.
 */
export function filedTimeOffStatus(requiresApproval: boolean | null | undefined): StatusTypesEnum {
	return requiresApproval === false ? StatusTypesEnum.APPROVED : StatusTypesEnum.REQUESTED;
}

/**
 * The policy a body names: `policyId`, or the id of the `policy` object the dialogs send.
 *
 * @param body The body.
 */
export function requestedPolicyId(body: ITimeOffWriteBody | null | undefined): ID | undefined {
	const id = body?.policyId ?? body?.policy?.id;
	return typeof id === 'string' && id ? id : undefined;
}

/**
 * The members of a body a write may store. `status`, `employees`, `tenantId`, `id` and anything not listed are
 * left out.
 *
 * @param body The body.
 * @param options.create True on create, where the organization is the body's (the save checks the caller's
 *                       organization boundary); an edit keeps the row's organization.
 */
export function writableTimeOffMembers(
	body: ITimeOffWriteBody | null | undefined,
	options: { create: boolean }
): ITimeOffWriteMembers {
	const source = body ?? {};
	const members: ITimeOffWriteMembers = {};
	const copy = <K extends keyof ITimeOffWriteMembers>(key: K) => {
		if (source[key] !== undefined) {
			members[key] = source[key] as ITimeOffWriteMembers[K];
		}
	};

	copy('description');
	copy('start');
	copy('end');
	copy('requestDate');
	copy('isHoliday');
	copy('documentUrl');
	if (options.create) {
		copy('organizationId');
	} else {
		// The lifecycle flags the Time Off page's Archive action sends as an edit.
		copy('isActive');
		copy('isArchived');
		copy('archivedAt');
	}

	const policyId = requestedPolicyId(source);
	if (policyId) {
		members.policy = { id: policyId };
	}

	if (source.documentId === null) {
		members.document = null;
	} else if (typeof source.documentId === 'string' && source.documentId) {
		members.document = { id: source.documentId };
	}

	return members;
}

/**
 * The employees a time-off write stores.
 *
 * @param requested The body's `employees`.
 * @param caller.mayActForOthers Whether the caller holds one of {@link TIME_OFF_FOR_OTHERS_PERMISSIONS}.
 * @param caller.ownEmployeeId The caller's own employee, if they have one.
 * @param options.create True on create; on an edit a caller who may not act for others keeps the stored employees.
 * @returns The employees as `{ id }`, or undefined to leave the stored ones untouched.
 * @throws ForbiddenException when a caller who may not act for others, and has no employee record, files a request.
 */
export function timeOffEmployees(
	requested: ITimeOffWriteBody['employees'],
	caller: { mayActForOthers: boolean; ownEmployeeId: ID | null },
	options: { create: boolean }
): Array<{ id: ID }> | undefined {
	if (caller.mayActForOthers) {
		if (!Array.isArray(requested)) {
			return options.create ? [] : undefined;
		}
		const ids = requested.map((employee) => employee?.id).filter((id): id is ID => typeof id === 'string' && !!id);
		return Array.from(new Set(ids)).map((id) => ({ id }));
	}

	if (!options.create) {
		return undefined;
	}

	if (!caller.ownEmployeeId) {
		throw new ForbiddenException('Only an employee, or a user who may act for employees, can file time off.');
	}
	return [{ id: caller.ownEmployeeId }];
}
