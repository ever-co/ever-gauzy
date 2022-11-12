import { ICustomSmtpFindInput, IOrganization } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { IsOrganizationBelongsToUser } from "./../../shared/validators";

/**
 * Custom Smtp Query Request DTO validation
 */
export class CustomSmtpQueryDTO implements ICustomSmtpFindInput {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsOrganizationBelongsToUser()
	readonly organizationId: IOrganization['id'];
}