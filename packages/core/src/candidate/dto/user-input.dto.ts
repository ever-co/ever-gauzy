import { IRole, IUser } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsEmail, IsNotEmpty, IsNotEmptyObject, IsObject, IsOptional } from "class-validator";

export class UserInputDTO implements IUser {

    @ApiProperty({ type: () => String, required : true })
    @IsNotEmpty()
    @IsEmail()
    @Transform((params: TransformFnParams) => params.value.trim())
    readonly email: string;

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsObject()
    @IsNotEmptyObject()
    readonly role?: IRole;

}