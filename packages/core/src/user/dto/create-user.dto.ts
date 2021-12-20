import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";
import { IUserCreateInput } from "@gauzy/contracts";

/**
 * Create User DTO validation
 */
export class CreateUserDTO implements IUserCreateInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsEmail()
    readonly email: string;

    @ApiProperty({ type: () => String })
    readonly firstName: string;

    @ApiProperty({ type: () => String })
    readonly lastName: string;

    @ApiProperty({ type: () => String })
    readonly imageUrl?: string;
}