import { ApiProperty, ApiPropertyOptional, IntersectionType, PartialType } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { Transform, TransformFnParams } from "class-transformer";
import { IUserCreateInput } from "@gauzy/contracts";
import { RoleFeatureDTO } from "./../../role/dto";
import { UserEmailDTO } from "./user-email.dto";

/**
 * Create User DTO validation
 */
export class CreateUserDTO extends IntersectionType(
    UserEmailDTO,
    PartialType(RoleFeatureDTO),
) implements IUserCreateInput {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    readonly firstName?: string;

    @ApiProperty({ type: () => String })
    @ApiPropertyOptional()
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    readonly lastName?: string;

    @ApiProperty({ type: () => String })
    @ApiPropertyOptional()
    readonly imageUrl?: string;
}
