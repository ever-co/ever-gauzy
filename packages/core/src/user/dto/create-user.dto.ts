import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

/**
 * Create User DTO validation
 */
export class CreateUserDTO {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsEmail()
    readonly email: string;

    @ApiProperty({ type: () => String })
    @IsString()
    readonly firstName: string;

    @ApiProperty({ type: () => String })
    @IsString()
    readonly lastName: string;
    readonly imageUrl?: string;
}