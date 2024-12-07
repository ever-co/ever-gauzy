import { IRelationalRole, IRole } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, ValidateIf } from "class-validator";
import { IsRoleShouldExist } from "./../../shared/validators";

export class RoleFeatureDTO implements IRelationalRole  {

    @ApiProperty({ type: () => String })
    @ValidateIf((it) => !it.role)
    @IsNotEmpty()
    @IsRoleShouldExist({
        message: 'RoleId {$value} should be exist for this tenant.'
    })
    readonly roleId: string;

    @ApiProperty({ type: () => String })
    @ValidateIf((it) => !it.roleId)
    @IsNotEmpty()
    @IsRoleShouldExist({
        message: 'Role should be exist for this tenant.'
    })
    readonly role: IRole;
}