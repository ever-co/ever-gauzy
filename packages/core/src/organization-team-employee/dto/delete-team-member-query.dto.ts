import { IntersectionType, PickType } from "@nestjs/swagger";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { TenantOrganizationBaseDTO } from "../../core/dto";
import { IBasePerTenantAndOrganizationEntityModel, IRelationalEmployee } from "@gauzy/contracts";

/**
 * Delete team member query DTO
 */
export class DeleteTeamMemberQueryDTO extends IntersectionType(
    PickType(TenantOrganizationBaseDTO, ['organizationId', 'tenantId']),
    PickType(EmployeeFeatureDTO, ['employeeId']),
) implements IBasePerTenantAndOrganizationEntityModel, IRelationalEmployee { }
