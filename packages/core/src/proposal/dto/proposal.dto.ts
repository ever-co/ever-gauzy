import { IOrganizationContact, ProposalStatusEnum } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class ProposalDTO extends TenantOrganizationBaseDTO {

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly jobPostUrl: string;

    @ApiProperty({ type: () => Date, readOnly: true })
    @IsNotEmpty()
    readonly valueDate: Date;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly jobPostContent: string;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsNotEmpty()
    @IsString()
    readonly proposalContent: string;

    @ApiProperty({ type: () => String, enum: ProposalStatusEnum, readOnly: true })
    @IsEnum(ProposalStatusEnum)
    readonly status: ProposalStatusEnum = ProposalStatusEnum.SENT;

    @ApiPropertyOptional({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly organizationContact: IOrganizationContact;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly organizationContactId: string;
}