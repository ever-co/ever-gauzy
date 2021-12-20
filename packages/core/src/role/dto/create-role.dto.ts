import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { IRoleCreateInput } from "@gauzy/contracts";
import { IsRoleAlreadyExist } from "./../../shared/decorators/validations";

/**
 * Create Role DTO validation
 */
export class CreateRoleDTO implements IRoleCreateInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsRoleAlreadyExist({
        message: 'Role $value already exists',
    })
    readonly name: string;
}