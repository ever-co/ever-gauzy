import { IOrganizationProjectsCreateInput } from "@gauzy/contracts";
import { OrganizationProjectDTO } from "./organization-project.dto";

/**
 * Create Organization Project DTO request validation
 */
export class CreateOrganizationProjectDTO extends OrganizationProjectDTO implements IOrganizationProjectsCreateInput {}