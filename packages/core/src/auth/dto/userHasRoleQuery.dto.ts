import { RolesEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsNotEmpty } from "class-validator";

const options = Object.values(RolesEnum);

export class UserHasRoleQueryDto {

    @ApiProperty({
        enum:options,
        default : RolesEnum.ADMIN,
        isArray:true,
        required:true
    })
    @IsNotEmpty({message:"roles should not be empty !"})
    @IsEnum(RolesEnum, { each: true })
    roles : RolesEnum[]
}