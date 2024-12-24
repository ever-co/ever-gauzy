import { IWarehouse } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

export class RelationalWarehouseDTO {

    @ApiPropertyOptional({ type: () => Array, isArray: true, readOnly: true })
    @IsOptional()
    readonly warehouses: IWarehouse[];
}