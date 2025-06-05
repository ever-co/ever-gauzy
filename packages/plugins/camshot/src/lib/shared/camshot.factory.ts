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
		const tenantId = input.tenantId || RequestContext.currentTenantId() || undefined;
		const organizationId = input.organizationId || undefined;
		const uploadedById = input.uploadedById || RequestContext.currentEmployeeId() || null;
		const userId = RequestContext.currentUserId() || undefined;

		return {
			tenantId,
			organizationId,
			uploadedById,
			userId
		}
	}
}
