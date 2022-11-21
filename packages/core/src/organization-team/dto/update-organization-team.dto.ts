import { ApiProperty, IntersectionType, PartialType } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { IOrganizationTeamUpdateInput } from "@gauzy/contracts";
import { RelationalTagDTO } from "./../../tags/dto";
import { OrganizationTeamDTO } from "./organization-team.dto";

/**
 * Update organization team request DTO's
 */
export class UpdateOrganizationTeamDTO extends IntersectionType(
    OrganizationTeamDTO,
    PartialType(RelationalTagDTO),
) implements IOrganizationTeamUpdateInput {

    @ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly id: string;
}