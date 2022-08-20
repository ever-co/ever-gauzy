import { IWarehouse } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { RelationalContactDTO } from "./../../contact/dto";
import { RelationalTagDTO } from "./../../tags/dto";
import { WarehouseDTO } from "./warehouse.dto";

/**
 * Create warehouse request DTO validation
 */
 export class CreateWarehouseDTO extends IntersectionType(
    WarehouseDTO,
    RelationalTagDTO,
    RelationalContactDTO
) implements IWarehouse {}