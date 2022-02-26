import { ISkillCreateInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { CandidateFeatureDTO } from "./../../candidate/dto";

export class CreateCandidateSkillDTO extends CandidateFeatureDTO  implements ISkillCreateInput {

    @ApiProperty({ type: () => String, required: true, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly name: string;
}