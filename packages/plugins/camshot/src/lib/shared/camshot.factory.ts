import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from "@gauzy/core";
import { CreateCamshotDTO } from "../dtos/create-camshot.dto";
import { ICamshot } from '../models/camshot.model';

export class CamshotFactory {
	public static create(input: CreateCamshotDTO): Partial<ICamshot> {
		return {
			...input,
			...this.common(input)
		}
	}

	private static common(input: CreateCamshotDTO) {
		const tenantId = input.tenantId || RequestContext.currentTenantId();
		const organizationId = input.organizationId;
		const employeeId = RequestContext.currentEmployeeId();
		// Without CHANGE_SELECTED_EMPLOYEE the upload is filed under the caller (none without an employee
		// record), the same owner the read and write routes check
		const uploadedById = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
			? input.uploadedById || employeeId
			: employeeId;
		const userId = RequestContext.currentUserId();

		return {
			tenantId,
			organizationId,
			uploadedById,
			userId
		}
	}
}
