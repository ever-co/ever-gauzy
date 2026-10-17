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
		// Like TenantAwareCrudService.create: an employee without CHANGE_SELECTED_EMPLOYEE uploads as themselves
		const uploadedById =
			employeeId && !RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)
				? employeeId
				: input.uploadedById || employeeId;
		const userId = RequestContext.currentUserId();

		return {
			tenantId,
			organizationId,
			uploadedById,
			userId
		}
	}
}
