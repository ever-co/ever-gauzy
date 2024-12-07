import { IMerchant } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { RelationalWarehouseDTO } from "./../../warehouse/dto";
import { RelationalContactDTO } from "./../../contact/dto";
import { MerchantDTO } from "./merchant.dto";

/**
 * Update merchant request DTO validation
 */
export class UpdateMerchantDTO extends IntersectionType(
    MerchantDTO,
    RelationalContactDTO,
    RelationalWarehouseDTO
) implements IMerchant {}