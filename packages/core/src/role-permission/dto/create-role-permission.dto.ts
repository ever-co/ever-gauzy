import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNotEmpty } from "class-validator";
import { IRolePermissionCreateInput, PermissionsEnum } from "@gauzy/contracts";

/**
 * Create Role DTO validation
 */
export class CreateRolePermissionDTO implements IRolePermissionCreateInput {

    @ApiProperty({ type: () => String, enum: PermissionsEnum })
    @IsNotEmpty()
    @IsEnum(PermissionsEnum, {
        message: 'permission `$value` must be a valid enum value'
    })
    readonly permission: PermissionsEnum;

    @ApiProperty({ type: () => Boolean })
    @IsBoolean()
    readonly enabled: boolean;

    @ApiProperty({ type: () => String })
    readonly roleId: string;
}