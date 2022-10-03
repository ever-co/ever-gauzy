import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { CreateCandidateSourceDTO } from "./create-candidate-source.dto";

export class CandidateSourceBulkInputDTO {

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateCandidateSourceDTO)
    list : CreateCandidateSourceDTO[]
}