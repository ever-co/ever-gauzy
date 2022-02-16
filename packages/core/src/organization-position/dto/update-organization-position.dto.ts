import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { RelationalTagDTO } from "tags/dto";

export class CreateOrganizationPositionDTO extends RelationalTagDTO {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsString()
    @IsNotEmpty()
    readonly name: string;
}