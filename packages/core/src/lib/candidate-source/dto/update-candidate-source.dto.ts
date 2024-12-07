import { ICandidateSourceUpdateInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class UpdateCandidateSourceDTO extends TenantOrganizationBaseDTO implements ICandidateSourceUpdateInput {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly name: string;
}