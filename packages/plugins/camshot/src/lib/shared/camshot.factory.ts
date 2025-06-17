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
		const uploadedById = input.uploadedById || RequestContext.currentEmployeeId();
		const userId = RequestContext.currentUserId();

		return {
			tenantId,
			organizationId,
			uploadedById,
			userId
		}
	}
}
