import { IOrganizationUpdateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { RelationalTagDTO } from "./../../tags/dto";
import { CreateOrganizationDTO } from "./create-organization.dto";
import { OrganizationBounsDTO } from "./organization-bonus.dto";
import { OrganizationSettingDTO } from "./organization-setting.dto";

/**
 * Organization Update DTO
 * 
 */
export class UpdateOrganizationDTO extends IntersectionType(
	CreateOrganizationDTO,
	OrganizationBounsDTO,
	OrganizationSettingDTO,
	RelationalTagDTO
) implements IOrganizationUpdateInput {}