import { IUserUpdateInput } from "@gauzy/contracts";
import { IntersectionType, OmitType, PartialType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { RoleFeatureDTO } from "./../../role/dto";
import { CreateUserDTO } from "./create-user.dto";

/**
 * Update User DTO validation
 */
export class UpdateUserDTO extends IntersectionType(
    OmitType(CreateUserDTO, ['role', 'roleId'] as const),
    PartialType(RoleFeatureDTO)
) implements IUserUpdateInput {

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isActive?: boolean;
}