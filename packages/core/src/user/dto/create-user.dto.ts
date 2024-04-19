import { ApiPropertyOptional, IntersectionType, PartialType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { Transform, TransformFnParams } from "class-transformer";
import { IUserCreateInput, LanguagesEnum } from "@gauzy/contracts";
import { RoleFeatureDTO } from "./../../role/dto";
import { UserEmailDTO } from "./user-email.dto";

/**
 * DTO (Data Transfer Object) for creating a user.
 * Extends UserEmailDTO and includes partial RoleFeatureDTO.
 */
export class CreateUserDTO extends IntersectionType(
    UserEmailDTO,
    PartialType(RoleFeatureDTO),
) implements IUserCreateInput {

    /**
     * Optional: User's first name.
     */
    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    readonly firstName?: string;

    /**
     * User's last name.
     */
    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    readonly lastName?: string;

    /**
     * Optional: User's image URL.
     */
    @ApiPropertyOptional()
    @IsOptional()
    readonly imageUrl?: string;

    /**
     * Optional: Preferred language for the user.
     */
    @ApiPropertyOptional({ type: () => String, enum: LanguagesEnum })
    @IsOptional()
    @IsEnum(LanguagesEnum)
    readonly preferredLanguage?: LanguagesEnum;
}
