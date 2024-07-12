import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from "class-validator";
import { IOrganizationContact, ProposalStatusEnum } from "@gauzy/contracts";
import { TenantOrganizationBaseDTO } from "@gauzy/core";

export class ProposalDTO extends TenantOrganizationBaseDTO {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly jobPostUrl: string;

    @ApiProperty({ type: () => Date })
    @IsNotEmpty()
    readonly valueDate: Date;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly jobPostContent: string;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly proposalContent: string;

    @ApiProperty({ type: () => String, enum: ProposalStatusEnum })
    @IsEnum(ProposalStatusEnum)
    readonly status: ProposalStatusEnum = ProposalStatusEnum.SENT;

    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    @IsObject()
    readonly organizationContact: IOrganizationContact;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsUUID()
    readonly organizationContactId: string;
}
