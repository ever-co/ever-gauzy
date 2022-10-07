import { ICandidateInterview, IRelationalCandidateInterview } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsString, ValidateIf } from "class-validator";

export class CandidateInterviewFeatureDTO implements IRelationalCandidateInterview {

    @ApiProperty({ type: () => String, readOnly: true })
    @ValidateIf((it) => !it.interviewerId || it.interviewer)
    @IsObject()
    readonly interview: ICandidateInterview;

    @ApiProperty({ type: () => Object, readOnly: true })
    @ValidateIf((it) => !it.interviewer || it.interviewerId)
    @IsString()
    readonly interviewId: ICandidateInterview['id'];
}