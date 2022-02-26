import { ICandidate } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsString, ValidateIf } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class CandidateFeatureDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => String, readOnly: true })
    @ValidateIf((ca) => !ca.candidate)
    @IsString()
    readonly candidateId: string;

    @ApiProperty({ type: () => Object, readOnly: true })
    @ValidateIf((ca) => !ca.candidateId)
    @IsObject()
    readonly candidate: ICandidate;
}