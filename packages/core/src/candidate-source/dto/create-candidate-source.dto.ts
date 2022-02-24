import { ICandidateSource } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { CandidateFeatureDTO } from "./../../candidate/dto";

export class CreateCandidateSourceDTO extends CandidateFeatureDTO implements ICandidateSource {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly name: string;
}