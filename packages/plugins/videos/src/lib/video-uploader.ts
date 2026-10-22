import { ID, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';

/**
 * The employee a new video is filed under.
 *
 * The body's `uploadedById` used to win over the caller, so any employee could file a recording under a colleague:
 * it then showed in that colleague's recordings, which the read, update and delete routes scope by `uploadedById`.
 * As the camshot and soundshot uploads do, only a caller who may act for other employees (CHANGE_SELECTED_EMPLOYEE)
 * names the uploader; anyone else's upload is filed under themselves (under no one without an employee record).
 *
 * @param requested - The `uploadedById` of the request body.
 * @returns The uploader's employee id, or null.
 */
export function videoUploaderOf(requested: ID | null | undefined): ID | null {
	const own = RequestContext.currentEmployeeId();
	return RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) ? requested || own : own;
}
