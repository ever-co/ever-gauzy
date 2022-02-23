import { ICandidateSource } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

export class CreateCandidateSourceDTO extends TenantOrganizationBaseDTO implements ICandidateSource {

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly name: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly candidateId: string;
}