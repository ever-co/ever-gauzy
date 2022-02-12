import { IOrganizationTeamCreateInput } from "@gauzy/contracts";
import { OrganizationTeamDTO } from "./organization-team.dto";

export class CreateOrganizationTeamDTO extends OrganizationTeamDTO implements IOrganizationTeamCreateInput {}