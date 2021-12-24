import { IResetPasswordRequest } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

/**
 * Reset Password Request DTO validation
 */
export class ResetPasswordRequestDTO implements IResetPasswordRequest {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly email: string;
}