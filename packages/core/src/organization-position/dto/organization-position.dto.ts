import { IOrganizationPosition } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class OrganizationPositionDTO extends TenantOrganizationBaseDTO 
    implements IOrganizationPosition {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly name: string;
}