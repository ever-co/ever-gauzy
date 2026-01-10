import { IntersectionType, OmitType } from "@nestjs/swagger";
import { ISharedEntityCreateInput } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "../../core/dto";
import { SharedEntity } from "../shared-entity.entity";

/**
 * Create Shared Entity DTO
 */
export class CreateSharedEntityDTO extends IntersectionType(TenantOrganizationBaseDTO, OmitType(SharedEntity, ['token'])) implements ISharedEntityCreateInput {}
