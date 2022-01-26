import { IOrganizationUpdateInput } from "@gauzy/contracts";
import { CreateOrganizationDTO } from "./create-organization.dto";

export class UpdateOrganizationDTO extends CreateOrganizationDTO 
    implements IOrganizationUpdateInput {

}