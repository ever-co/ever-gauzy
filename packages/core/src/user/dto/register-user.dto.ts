import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, MinLength, ValidateNested } from "class-validator";
import { Match } from "./../../shared/decorators/validations";
import { CreateUserDTO } from "./create-user.dto";

/**
 * Register User DTO validation
 */
export class RegisterUserDTO {

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
    @ValidateNested({ each: true })
    readonly user: CreateUserDTO;
}