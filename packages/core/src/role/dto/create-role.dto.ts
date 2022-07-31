import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { IRoleCreateInput } from "@gauzy/contracts";
import { IsRoleAlreadyExist } from "./../../shared/validators";

/**
 * Create Role DTO validation
 */
export class CreateRoleDTO implements IRoleCreateInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsRoleAlreadyExist()
    readonly name: string;
}