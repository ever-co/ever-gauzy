import { ICandidateSource } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { CandidateFeatureDTO } from "candidate/dto";
import { IsNotEmpty, IsString } from "class-validator";
export class CreateCandidateSourceDTO extends CandidateFeatureDTO implements ICandidateSource {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly name: string;

}