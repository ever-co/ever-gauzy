import { ICandidate, IRelationalCandidate } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsString, ValidateIf } from "class-validator";

export class CandidateFeatureDTO implements IRelationalCandidate {

    @ApiProperty({ type: () => String, readOnly: true })
    @ValidateIf((it) => !it.candidate || it.candidateId)
    @IsString()
    readonly candidateId: ICandidate['id'];

    @ApiProperty({ type: () => Object, readOnly: true })
    @ValidateIf((it) => !it.candidateId || it.candidate)
    @IsObject()
    readonly candidate: ICandidate;
}