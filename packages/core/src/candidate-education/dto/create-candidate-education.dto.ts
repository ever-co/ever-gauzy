import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsNotEmpty, IsOptional } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";
import { CandidateFeatureDTO } from "./../../candidate/dto";

export class CreateCandidateEducationDTO extends IntersectionType(
    CandidateFeatureDTO,
    TenantOrganizationBaseDTO
) {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    readonly schoolName: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    readonly degree: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    readonly field: string;

    @ApiProperty({ type: () => Date, readOnly: true })
    @IsNotEmpty()
    @IsDateString()
    readonly completionDate: Date;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    readonly notes: string;
}