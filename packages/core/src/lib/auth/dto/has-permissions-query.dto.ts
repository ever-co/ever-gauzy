import { PermissionsEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum } from "class-validator";

export class HasPermissionsQueryDTO {

    @ApiProperty({ type: () => Array, isArray: true, required: true })
    @IsEnum(PermissionsEnum, { each: true })
    @IsArray()
    permissions: PermissionsEnum[] = [];
}