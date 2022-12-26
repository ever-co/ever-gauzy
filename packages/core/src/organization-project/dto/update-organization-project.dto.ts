import { IOrganizationProjectsUpdateInput } from "@gauzy/contracts";
import { OrganizationProjectDTO } from "./organization-project.dto";

/**
 * Update Organization Project DTO request validation
 */
export class UpdateOrganizationProjectDTO extends OrganizationProjectDTO implements IOrganizationProjectsUpdateInput {}