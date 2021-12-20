import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { IUserLoginInput } from "@gauzy/contracts";

/**
 * Login User DTO validation
 */
export class LoginUserDTO implements IUserLoginInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty({ message: "Email should not be empty" })
    readonly email: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty({ message: "Password should not be empty" })
    readonly password: string;
}