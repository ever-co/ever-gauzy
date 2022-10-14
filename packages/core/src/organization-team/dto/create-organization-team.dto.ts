import { IOrganizationTeamCreateInput } from "@gauzy/contracts";
import { IntersectionType, PartialType } from "@nestjs/mapped-types";
import { RelationalTagDTO } from "./../../tags/dto";
import { OrganizationTeamDTO } from "./organization-team.dto";

/**
 * Create organization team request DTO's
 */
export class CreateOrganizationTeamDTO extends IntersectionType(
    OrganizationTeamDTO,
    PartialType(RelationalTagDTO),
) implements IOrganizationTeamCreateInput {}