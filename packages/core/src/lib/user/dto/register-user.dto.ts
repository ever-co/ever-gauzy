import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsNotEmptyObject, IsObject, IsOptional, IsUUID, MinLength, ValidateNested } from "class-validator";
import { IUserRegistrationInput } from "@gauzy/contracts";
import { Match } from "./../../shared/validators";
import { CreateUserDTO } from "./create-user.dto";

/**
 * Register User DTO validation
 */
export class RegisterUserDTO implements IUserRegistrationInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty({ message: "Password should not be empty" })
    @MinLength(4, {
        message: 'Password should be at least 4 characters long.'
    })
    readonly password: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty({ message: "Confirm password should not be empty" })
    @Match(RegisterUserDTO, (it) => it.password, {
        message: 'The password and confirmation password must match.'
    })
    readonly confirmPassword: string;

    @ApiProperty({ type: () => CreateUserDTO })
    @IsObject()
    @IsNotEmptyObject()
    @IsNotEmpty({ message: "User should not be empty" })
    @ValidateNested()
    @Type(() => CreateUserDTO)
    readonly user: CreateUserDTO;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsUUID()
    readonly organizationId?: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsUUID()
    readonly createdByUserId?: string;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly featureAsEmployee?: boolean;
}
