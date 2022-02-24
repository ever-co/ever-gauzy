import { ISkillCreateInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { CandidateFeatureDTO } from "candidate/dto";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateCandidateSkillDTO extends CandidateFeatureDTO  implements ISkillCreateInput {

    @ApiProperty({ type: () => String, required: true, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly name: string;

}