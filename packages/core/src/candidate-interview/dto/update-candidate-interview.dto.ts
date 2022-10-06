import { ICandidateInterview } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateCandidateInterviewDTO } from "./create-candidate-interview.dto";

/**
 * UPDATE candidate interview DTO request validation
 *
 */
export class UpdateCandidateInterviewDTO extends CreateCandidateInterviewDTO {

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isArchived: ICandidateInterview['isArchived'];
}