import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional } from "class-validator";
import { IUserCreateInput } from "@gauzy/contracts";
import { Transform, TransformFnParams } from "class-transformer";
import { RoleFeatureDTO } from "./../../role/dto";

/**
 * Create User DTO validation
 */
export class CreateUserDTO extends RoleFeatureDTO implements IUserCreateInput {

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
}