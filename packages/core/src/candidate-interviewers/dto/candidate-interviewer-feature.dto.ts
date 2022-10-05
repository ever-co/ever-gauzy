import { ICandidateInterviewers, IRelationalCandidateInterviewer } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsString, ValidateIf } from "class-validator";

export class CandidateInterviewerFeatureDTO implements IRelationalCandidateInterviewer {

    @ApiProperty({ type: () => String, readOnly: true })
    @ValidateIf((it) => !it.interviewerId || it.interviewer)
    @IsObject()
    readonly interviewer: ICandidateInterviewers;

    @ApiProperty({ type: () => Object, readOnly: true })
    @ValidateIf((it) => !it.interviewer || it.interviewerId)
    @IsString()
    readonly interviewerId: ICandidateInterviewers['id'];
}