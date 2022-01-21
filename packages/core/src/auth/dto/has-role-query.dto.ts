import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class HasRoleQueryDto {

    @ApiProperty({ type:()=>String})
    @IsNotEmpty({message:"roles should not be empty !"})
    roles : string[]
}