import { IRole, IUserUpdateInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNotEmptyObject, IsObject } from "class-validator";

export class UpdateUserDto implements IUserUpdateInput {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    email: string;

    @ApiProperty({ type: () => Object })
    @IsObject()
    @IsNotEmptyObject()
    role: IRole;

}