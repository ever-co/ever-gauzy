import { IOrganizationUpdateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { CreateOrganizationDTO } from "./create-organization.dto";
import { OrganizationPublicSettingDTO } from "./organization-public-setting.dto";

/**
 * Organization Update DTO
 *
 */
export class UpdateOrganizationDTO extends IntersectionType(
	CreateOrganizationDTO,
	OrganizationPublicSettingDTO
) implements IOrganizationUpdateInput {}