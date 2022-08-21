import { IWarehouse } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { RelationalContactDTO } from "./../../contact/dto";
import { RelationalTagDTO } from "./../../tags/dto";
import { WarehouseDTO } from "./warehouse.dto";

/**
 * Update warehouse request DTO validation
 */
export class UpdateWarehouseDTO extends IntersectionType(
    WarehouseDTO,
    RelationalTagDTO,
    RelationalContactDTO
) implements IWarehouse {}