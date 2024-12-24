import { IntersectionType, PartialType, PickType } from "@nestjs/swagger";
import { IImageAssetUploadInput } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Upload image asset request DTO validation
 */
export class UploadImageAsset extends IntersectionType(
    PartialType(
        PickType(TenantOrganizationBaseDTO, ['tenantId', 'organizationId'])
    )
) implements IImageAssetUploadInput { }
