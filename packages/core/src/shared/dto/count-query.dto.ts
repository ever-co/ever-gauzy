import { PickType } from "@nestjs/swagger";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Entity Count DTO
 *
 */
export class CountQueryDTO<T> extends PickType(TenantOrganizationBaseDTO, ['organizationId']) { }