import { ApiProperty } from "@nestjs/swagger";
import { PartialType } from "@nestjs/mapped-types";
import { IsEmail, IsNotEmpty, IsOptional } from "class-validator";
import { Transform, TransformFnParams } from "class-transformer";
import { IUserCreateInput } from "@gauzy/contracts";
import { RoleFeatureDTO } from "./../../role/dto";

/**
 * Create User DTO validation
 */
export class CreateUserDTO extends PartialType(RoleFeatureDTO) implements IUserCreateInput {

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
    @IsOptional()
    readonly imageUrl?: string;
}