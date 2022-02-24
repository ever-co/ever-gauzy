import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { UpdateCandidateSourceDTO } from "./update-candidate-source.dto";

export class CandidateSourceBulkInputDTO {

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateCandidateSourceDTO)
    list : UpdateCandidateSourceDTO[]
}