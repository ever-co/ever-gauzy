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
