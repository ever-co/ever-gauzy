import { IResetEmailRequest } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsEmail, IsNotEmpty } from "class-validator";
import { UserEmailDTO } from "../../user/dto";

/**
 * Reset Email Request DTO validation
 */
export class ResetEmailRequestDTO extends UserEmailDTO implements IResetEmailRequest {
    @ApiProperty({ type: () => String, required: true })
    @IsNotEmpty()
    @IsEmail()
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    readonly oldEmail: string;
}
