import { ApiPropertyOptional, IntersectionType, PartialType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { IUserCreateInput, LanguagesEnum } from "@gauzy/contracts";
import { Trimmed } from "../../shared/decorators/trim.decorator";
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
    @Trimmed()
    readonly firstName?: string;

    /**
     * User's last name.
     */
    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @Trimmed()
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
