import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { IRoleFindInput } from "@gauzy/contracts";
import { TenantBaseDTO } from "./../../core/dto";

/**
 * Find Role Query DTO validation
 */
export class FindRoleQueryDTO extends TenantBaseDTO implements IRoleFindInput {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    readonly name: string;
}