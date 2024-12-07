import { OmitType } from "@nestjs/mapped-types";
import { CreateCandidateExperienceDTO } from "./create-candidate-experience.dto";

/**
 * UPDATE candidate experience DTO request validation
 *
 */
export class UpdateCandidateExperienceDTO extends OmitType(
    CreateCandidateExperienceDTO, [
        'candidate',
        'candidateId'
    ] as const
) {}