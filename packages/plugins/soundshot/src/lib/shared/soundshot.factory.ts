import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from "@gauzy/core";
import { CreateSoundshotDTO } from "../dtos/create-soundshot.dto";
import { ISoundshot } from '../models/soundshot.model';

export class SoundshotFactory {
	public static create(input: CreateSoundshotDTO): Partial<ISoundshot> {
		return {
			...input,
			...this.common(input)
		}
	}

	private static common(input: CreateSoundshotDTO) {
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
