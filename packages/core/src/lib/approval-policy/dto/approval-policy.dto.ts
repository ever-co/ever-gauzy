import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class ApprovalPolicyDTO extends TenantOrganizationBaseDTO {

    @ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	readonly name: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
	@IsOptional()
	readonly description: string;
}