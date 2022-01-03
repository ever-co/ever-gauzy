import { IRolePermissionUpdateInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

/**
 * Update Role Permission DTO validation
 */
export class UpdateRolePermissionDTO implements IRolePermissionUpdateInput {

    @ApiProperty({ type: () => Boolean })
    @IsBoolean()
    readonly enabled: boolean;
}