import { ICandidateInterviewer } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsString, ValidateIf } from "class-validator";

export class InterviewerFeatureFeatureDTO {

    @ApiProperty({ type: () => String, readOnly: true })
    @ValidateIf((it) => !it.interviewerId || it.interviewer)
    @IsObject()
    readonly interviewer: ICandidateInterviewer;

    @ApiProperty({ type: () => Object, readOnly: true })
    @ValidateIf((it) => !it.interviewer || it.interviewerId)
    @IsString()
    readonly interviewerId: ICandidateInterviewer['id'];
}