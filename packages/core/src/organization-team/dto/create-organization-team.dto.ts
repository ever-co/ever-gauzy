import { IOrganizationTeamCreateInput } from "@gauzy/contracts";
import { ApiPropertyOptional, IntersectionType, PartialType } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { RelationalTagDTO } from "./../../tags/dto";
import { OrganizationTeamDTO } from "./organization-team.dto";

/**
 * Create organization team request DTO's
 */
export class CreateOrganizationTeamDTO extends IntersectionType(
    OrganizationTeamDTO,
    PartialType(RelationalTagDTO),
) implements IOrganizationTeamCreateInput {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly profile_link?: string;
}
