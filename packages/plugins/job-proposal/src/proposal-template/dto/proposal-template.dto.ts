import { IEmployeeProposalTemplate } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "@gauzy/core";

/**
 * Proposal template common request DTO validation
 *
 */
export class ProposalTemplateDTO extends TenantOrganizationBaseDTO implements IEmployeeProposalTemplate {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly content: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isDefault: boolean;
}
