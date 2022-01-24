import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";
import { IUserCreateInput } from "@gauzy/contracts";
import { Transform, TransformFnParams } from "class-transformer";

/**
 * Create User DTO validation
 */
export class CreateUserDTO implements IUserCreateInput {

    @ApiProperty({ type: () => String, required : true })
    @IsNotEmpty()
    @IsEmail()
    @Transform((params: TransformFnParams) => params.value.trim())
    readonly email: string;

    @ApiProperty({ type: () => String })
    @Transform((params: TransformFnParams) => params.value.trim())
    readonly firstName?: string;

    @ApiProperty({ type: () => String })
    @Transform((params: TransformFnParams) => params.value.trim())
    readonly lastName?: string;

    @ApiProperty({ type: () => String })
    readonly imageUrl?: string;
}