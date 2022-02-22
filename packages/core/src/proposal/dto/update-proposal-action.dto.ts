import { ProposalStatusEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional } from "class-validator";

export class UpdateProposalActionDTO {

    @ApiProperty({ type: () => String, enum: ProposalStatusEnum })
    @IsOptional()
    @IsNotEmpty()
    @IsEnum(ProposalStatusEnum)
    readonly status: ProposalStatusEnum;

}