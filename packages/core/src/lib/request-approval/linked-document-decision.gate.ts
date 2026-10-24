import { ForbiddenException } from '@nestjs/common';
import { ApprovalPolicyTypesStringEnum, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { SHARING_DECISION_PERMISSIONS } from '../equipment-sharing/filed-status.helper';

/**
 * The gate a document's own approve/refuse route states: the roles the caller must hold (any of them; none
 * listed means no role is required) and the permissions (any of them, as `PermissionGuard` reads a list).
 */
export interface IDocumentDecisionGate {
	roles: ReadonlyArray<RolesEnum>;
	permissions: ReadonlyArray<PermissionsEnum>;
}

/**
 * `PUT /time-off-request/approval/:id` and `PUT /time-off-request/denied/:id`: `@Roles(SUPER_ADMIN, ADMIN)`
 * behind `RoleGuard`, and `@Permissions(ALL_ORG_EDIT, TIME_OFF_EDIT)`.
 */
export const TIME_OFF_DECISION_GATE: IDocumentDecisionGate = Object.freeze({
	roles: Object.freeze([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]),
	permissions: Object.freeze([PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT])
});

/**
 * `PUT /equipment-sharing/approval/:id` and `PUT /equipment-sharing/refuse/:id`:
 * `@Permissions(EQUIPMENT_APPROVE_REQUEST, ORG_EQUIPMENT_SHARING_EDIT)`, no role.
 */
export const EQUIPMENT_SHARING_DECISION_GATE: IDocumentDecisionGate = Object.freeze({
	roles: Object.freeze([] as RolesEnum[]),
	permissions: SHARING_DECISION_PERMISSIONS
});

/**
 * The gate of the document a request approval is about, or null when deciding the request moves no document
 * (a business trip, a purchase or sales order — whose own flows settle them).
 *
 * @param requestType The request's `requestType`.
 */
export function documentDecisionGateOf(requestType: string | null | undefined): IDocumentDecisionGate | null {
	switch (requestType) {
		case ApprovalPolicyTypesStringEnum.TIME_OFF:
			return TIME_OFF_DECISION_GATE;
		case ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING:
			return EQUIPMENT_SHARING_DECISION_GATE;
		default:
			return null;
	}
}

/**
 * Whether the current caller passes a gate, read from the request's DB-fresh role and permissions.
 *
 * @param gate The gate.
 */
export function passesDocumentDecisionGate(gate: IDocumentDecisionGate): boolean {
	const hasRole = gate.roles.length === 0 || RequestContext.hasRoles([...gate.roles]);
	return hasRole && RequestContext.hasAnyPermission([...gate.permissions]);
}

/**
 * Refuses a decision that would move a time-off request or an equipment sharing for a caller who could not move
 * it through that document's own approve/refuse route. A request approval is a second door onto the same state
 * change, so it states the same lock.
 *
 * @param requestType The request's `requestType`.
 * @throws ForbiddenException when the caller does not pass the document's gate.
 */
export function assertMayDecideLinkedDocument(requestType: string | null | undefined): void {
	const gate = documentDecisionGateOf(requestType);
	if (gate && !passesDocumentDecisionGate(gate)) {
		throw new ForbiddenException(
			`Deciding this request approval decides the ${requestType} it is about, which needs the permission that document's own approval route needs.`
		);
	}
}
