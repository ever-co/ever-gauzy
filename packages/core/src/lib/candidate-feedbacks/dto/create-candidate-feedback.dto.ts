import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IntersectionType } from "@nestjs/mapped-types";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from "class-validator";
import { CandidateStatusEnum } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "./../../core/dto";
import { CandidateFeatureDTO } from "./../../candidate/dto";
import { CandidateInterviewerFeatureDTO } from "./../../candidate-interviewers/dto";
import { CandidateInterviewFeatureDTO } from "./../../candidate-interview/dto";

/**
 * CREATE candidate feedback DTO request validation
 *
 */
export class CreateCandidateFeedbackDTO extends IntersectionType(
    TenantOrganizationBaseDTO,
    CandidateFeatureDTO,
    CandidateInterviewerFeatureDTO,
    CandidateInterviewFeatureDTO
) {

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    readonly description: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsNumber()
    readonly rating: number;

    @ApiPropertyOptional({ type: () => String, enum: CandidateStatusEnum, readOnly: true })
    @IsOptional()
    @IsEnum(CandidateStatusEnum)
    readonly status: CandidateStatusEnum;
}