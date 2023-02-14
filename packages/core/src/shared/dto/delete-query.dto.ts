import { PickType } from "@nestjs/swagger";
import { TenantOrganizationBaseDTO } from "../../core/dto";

/**
 * Delete query DTO
 *
 */
export class DeleteQueryDTO<T> extends PickType(TenantOrganizationBaseDTO, ['organizationId', 'tenantId']) { }
