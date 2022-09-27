import { IEmployeeProposalTemplate } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Proposal template common request DTO validation
 *
 */
export class ProposalTemplateDTO extends TenantOrganizationBaseDTO implements IEmployeeProposalTemplate {

	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly name: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly content: string;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
	@IsOptional()
	@IsBoolean()
	readonly isDefault: boolean;
}