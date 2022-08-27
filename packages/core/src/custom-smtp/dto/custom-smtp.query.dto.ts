import { ICustomSmtpFindInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

/**
 * Custom Smtp Query Request DTO validation
 */
export class CustomSmtpQueryDTO implements ICustomSmtpFindInput {

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly organizationId: string;
}