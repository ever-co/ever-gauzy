import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { IRoleCreateInput } from "@gauzy/contracts";
import { IsRoleAlreadyExist } from "./../../shared/validators";
import { TenantBaseDTO } from "./../../core/dto";

/**
 * Create Role DTO validation
 */
export class CreateRoleDTO extends TenantBaseDTO implements IRoleCreateInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsRoleAlreadyExist()
    readonly name: string;
}
