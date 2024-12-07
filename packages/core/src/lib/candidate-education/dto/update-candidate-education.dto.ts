import { OmitType } from "@nestjs/swagger";
import { CreateCandidateEducationDTO } from "./create-candidate-education.dto";

export class UpdateCandidateEducationDTO extends OmitType(
    CreateCandidateEducationDTO,
    ['candidate', 'candidateId']
) {}