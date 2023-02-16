import { IOrganizationTeamEmployeeUpdateInput } from "@gauzy/contracts";
import { IntersectionType, PickType } from "@nestjs/swagger";
import { OrganizationTeamEmployee } from "./../../core/entities/internal";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class UpdateTeamMemberDTO extends IntersectionType(
    TenantOrganizationBaseDTO,
    PickType(OrganizationTeamEmployee, ['isTrackingEnabled'])
) implements IOrganizationTeamEmployeeUpdateInput { }
