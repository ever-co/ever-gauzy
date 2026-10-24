import { ForbiddenException } from '@nestjs/common';
import { ID, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';

/**
 * The roles that administer a tenant: they reach every row of it (owner decision 1, 2026-10-22).
 */
const TENANT_ADMINISTRATORS: ReadonlyArray<RolesEnum> = Object.freeze([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]);

/**
 * Who wrote a row: the user who created it, and the employee the row names as its author, where it names one.
 *
 * Each service says which of its columns that is — `createdByUserId` for the user (stamped from the request by
 * the base entity subscriber, never from a body), and the row's own author column for the employee (a mention's
 * `employeeId` is the employee who wrote it, a subscription's `employeeId` the employee it belongs to). A member
 * left out is not compared.
 */
export interface IRowAuthor {
	userId?: ID | null;
	employeeId?: ID | null;
}

/**
 * Whether the caller administers their tenant (`SUPER_ADMIN` or `ADMIN`), read from the role the user holds now —
 * not from the role claim baked into their access token.
 */
export function isCallerTenantAdmin(): boolean {
	return RequestContext.hasRoles([...TENANT_ADMINISTRATORS]);
}

/**
 * Whether the caller is the author of a row: the user who created it, or the employee it names as its author.
 *
 * The caller's employee is their own record (`currentUser().employeeId`), also for a holder of
 * `CHANGE_SELECTED_EMPLOYEE`: acting for a selected employee does not make the caller the author of that
 * employee's rows.
 *
 * @param author - The row's author, as the service reads it off the stored row.
 */
export function isCallerAuthor(author: IRowAuthor): boolean {
	const userId = RequestContext.currentUserId();
	if (userId && author.userId && author.userId === userId) {
		return true;
	}

	const employeeId = RequestContext.currentUser()?.employeeId;
	return !!employeeId && !!author.employeeId && author.employeeId === employeeId;
}

/**
 * Refuses a change to a per-user row by anyone but its author or a tenant administrator (owner decision 2,
 * 2026-10-22).
 *
 * These rows — mentions, resource links, entity subscriptions, key-result progress updates — belong to the person
 * who wrote them, and their routes state no permission (GHSA-v79w-54p2-wmh5: any signed-in member of the tenant
 * reached them). The service reads the row in the caller's tenant first, so a row of another tenant is still a
 * miss (404) rather than a refusal.
 *
 * @param author - The row's author, as the service reads it off the stored row.
 * @param what - The row, for the message ("a mention").
 * @throws ForbiddenException when the caller is neither the author nor a tenant administrator.
 */
export function assertCallerIsAuthorOrTenantAdmin(author: IRowAuthor, what: string): void {
	if (isCallerAuthor(author) || isCallerTenantAdmin()) {
		return;
	}

	throw new ForbiddenException(`Only the author of ${what}, or a tenant administrator, may change it`);
}

/**
 * A patch without the columns that say who wrote the row, so a change cannot hand the row to someone else.
 *
 * `createdByUserId` is never written from a patch, nor its `createdByUser` relation, which a save would write the
 * column from. The row's own author columns (`employeeColumns`: a mention's
 * `employeeId` and `employee`, say) are dropped for everyone but a tenant administrator: an author may change what
 * they wrote, not say that someone else wrote it.
 *
 * @param patch - The columns the caller asked to write.
 * @param employeeColumns - The row's author columns, beside `createdByUserId`.
 * @returns The same columns without the author ones.
 */
export function withoutAuthorChange<P>(patch: P, employeeColumns: ReadonlyArray<string> = []): P {
	if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
		return patch;
	}

	const rest = { ...(patch as Record<string, unknown>) };
	delete rest['createdByUserId'];
	delete rest['createdByUser'];
	delete rest['createdBy'];

	if (!isCallerTenantAdmin()) {
		for (const column of employeeColumns) {
			delete rest[column];
		}
	}

	return rest as P;
}
