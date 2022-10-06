import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IntersectionType } from "@nestjs/mapped-types";
import { IsDateString, IsNotEmpty, IsNumber, IsOptional } from "class-validator";
import { ICandidateInterview, ICandidateInterviewCreateInput } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "./../../core/dto";
import { CandidateFeatureDTO } from "./../../candidate/dto";

/**
 * CREATE candidate interview DTO request validation
 *
 */
export class CreateCandidateInterviewDTO extends IntersectionType(
    CandidateFeatureDTO,
    TenantOrganizationBaseDTO
) implements ICandidateInterviewCreateInput {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    readonly title: ICandidateInterview['title'];

    @ApiProperty({ type: () => Date, readOnly: true })
    @IsNotEmpty()
    @IsDateString()
    readonly startTime: ICandidateInterview['startTime'];

    @ApiProperty({ type: () => Date, readOnly: true })
    @IsNotEmpty()
    @IsDateString()
    readonly endTime: ICandidateInterview['endTime'];

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    readonly location: ICandidateInterview['location'];

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    readonly note: ICandidateInterview['note'];

    @ApiPropertyOptional({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly rating: ICandidateInterview['rating'];
}