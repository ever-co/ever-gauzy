import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNotEmpty, ValidateIf } from "class-validator";
import { IRolePermissionCreateInput, PermissionsEnum } from "@gauzy/contracts";
import { IsRoleShouldExist } from "./../../shared/decorators/validations";

/**
 * Create Role Permission DTO validation
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
    @ValidateIf((it) => Object.values(PermissionsEnum).includes(it.permission))
    @IsNotEmpty()
    @IsRoleShouldExist()
    readonly roleId: string;
}