import { IEquipment, IOrganization } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, ValidateNested } from "class-validator";
import { TenantDTO } from "tenant/dto";
import { EquipmentDTO } from "./equipment.dto";

export class CreateEquipmentDTO extends EquipmentDTO implements IEquipment {

    @ApiProperty({ type: () => Object })
    @IsOptional()
    readonly organization?: IOrganization;

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @ValidateNested()
    @Type(() => TenantDTO)
    readonly tenant?: TenantDTO;

}