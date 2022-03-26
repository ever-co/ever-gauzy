import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNotEmpty, ValidateIf } from "class-validator";
import { IRole, IRolePermissionCreateInput, PermissionsEnum } from "@gauzy/contracts";
import { IsRoleShouldExist } from "./../../shared/decorators/validations";
import { TenantBaseDTO } from "./../../core/dto";

/**
 * Create Role Permission DTO validation
 */
export class CreateRolePermissionDTO extends TenantBaseDTO implements IRolePermissionCreateInput {

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
    @ValidateIf((it) => !it.role)
    @IsNotEmpty()
    @IsRoleShouldExist({
        message: 'roleId {$value} must be a valid value'
    })
    readonly roleId: string;

    @ApiProperty({ type: () => String })
    @ValidateIf((it) => !it.roleId)
    @IsNotEmpty()
    @IsRoleShouldExist({
        message: 'role must be a valid value'
    })
    readonly role: IRole;
}