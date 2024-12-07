import { ICandidateSkillCreateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";
import { CandidateFeatureDTO } from "./../../candidate/dto";

export class CreateCandidateSkillDTO extends IntersectionType(
    CandidateFeatureDTO,
    TenantOrganizationBaseDTO
)  implements ICandidateSkillCreateInput {

    @ApiProperty({ type: () => String, required: true, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly name: string;
}