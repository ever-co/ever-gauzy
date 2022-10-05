import { OmitType } from "@nestjs/mapped-types";
import { CreateCandidateFeedbackDTO } from "./create-candidate-feedback.dto";

/**
 * UPDATE candidate feedback DTO request validation
 *
 */
export class UpdateCandidateFeedbackDTO extends OmitType(
    CreateCandidateFeedbackDTO, ['candidate', 'candidateId'] as const
) {}