import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { ICustomSmtpFindInput, IOrganization } from "@gauzy/contracts";
import { IsOrganizationBelongsToUser } from "./../../shared/validators";

/**
 * Custom Smtp Query Request DTO validation
 */
export class CustomSmtpQueryDTO implements ICustomSmtpFindInput {

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@IsOrganizationBelongsToUser()
	readonly organizationId: IOrganization['id'];
}
