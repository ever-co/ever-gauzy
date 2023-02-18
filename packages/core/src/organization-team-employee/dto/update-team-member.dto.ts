import { IOrganizationTeamEmployeeUpdateInput } from "@gauzy/contracts";
import { IntersectionType, PickType } from "@nestjs/swagger";
import { OrganizationTeamEmployee } from "./../../core/entities/internal";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Update team member entity DTO
 */
export class UpdateTeamMemberDTO extends IntersectionType(TenantOrganizationBaseDTO, PickType(
    OrganizationTeamEmployee,
    ['isTrackingEnabled', 'organizationTeamId']
)) implements IOrganizationTeamEmployeeUpdateInput { }
