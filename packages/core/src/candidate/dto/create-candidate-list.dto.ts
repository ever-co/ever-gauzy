import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { CreateCandidateDTO } from ".";

export class CreateCandidateListDTO {

    @ApiProperty({ type: () => Array, required : true })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateCandidateDTO)
    readonly list : CreateCandidateDTO[]

}