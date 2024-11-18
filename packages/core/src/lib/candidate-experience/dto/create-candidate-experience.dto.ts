import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";
import { CandidateFeatureDTO } from "./../../candidate/dto";

/**
 * CREATE candidate experience DTO request validation
 *
 */
export class CreateCandidateExperienceDTO extends IntersectionType(
    CandidateFeatureDTO,
    TenantOrganizationBaseDTO
) {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    readonly occupation: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    readonly duration: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    readonly description: string;
}