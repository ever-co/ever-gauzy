import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty } from "class-validator";

export class HasRoleQueryDTO {

    @ApiProperty({ type: () => Array })
    @IsNotEmpty({
        message: "roles should not be empty!"
    })
    @IsArray()
    roles : string[]
}