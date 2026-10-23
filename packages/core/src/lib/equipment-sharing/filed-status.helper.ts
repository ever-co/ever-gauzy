import { PermissionsEnum, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';

/**
 * The grants that decide a sharing: the ones the approve, refuse and edit routes state.
 */
export const SHARING_DECISION_PERMISSIONS: ReadonlyArray<PermissionsEnum> = Object.freeze([
	PermissionsEnum.EQUIPMENT_APPROVE_REQUEST,
	PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT
]);

/**
 * The status a new equipment sharing is filed with.
 *
 * The create route is open to whoever may make a request (`EQUIPMENT_MAKE_REQUEST`, which every employee holds), and
 * the status used to be whatever the body said: the form sends `APPROVED` itself when the chosen equipment
 * auto-approves its shares, so any requester could file an approved sharing for any equipment and skip the approver.
 * A caller who may decide a sharing still files the status they chose; anyone else gets `APPROVED` only when the
 * equipment (read from the store, in the sharing's organization) auto-approves its shares, else `REQUESTED`.
 *
 * Lives in its own module, free of entity imports, so it can be unit-tested: importing the service pulls in the entity
 * graph (see `reference-scope.helper.ts`).
 *
 * @param requested - The status the request body carries, if any.
 * @param mayDecide - Whether the caller holds one of {@link SHARING_DECISION_PERMISSIONS}.
 * @param autoApprovesShare - Reads whether the requested equipment auto-approves its shares; only called for a
 *                            caller who may not decide.
 * @returns The status to store on the sharing and on its approval row.
 */
export async function filedSharingStatus(
	requested: number | undefined,
	mayDecide: boolean,
	autoApprovesShare: () => Promise<boolean>
): Promise<number> {
	if (mayDecide) {
		return requested ?? RequestApprovalStatusTypesEnum.REQUESTED;
	}
	return (await autoApprovesShare())
		? RequestApprovalStatusTypesEnum.APPROVED
		: RequestApprovalStatusTypesEnum.REQUESTED;
}
