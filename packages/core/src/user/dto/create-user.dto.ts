import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsNotEmptyObject, IsObject, IsOptional } from "class-validator";
import { IRole, IUserCreateInput } from "@gauzy/contracts";
import { Transform, TransformFnParams } from "class-transformer";

/**
 * Create User DTO validation
 */
export class CreateUserDTO implements IUserCreateInput {

    @ApiProperty({ type: () => String, required : true })
    @IsNotEmpty()
    @IsEmail()
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    readonly email: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    readonly firstName?: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    readonly lastName?: string;

    @ApiProperty({ type: () => String })
    readonly imageUrl?: string;

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsObject()
    @IsNotEmptyObject()
    readonly role?: IRole;
}