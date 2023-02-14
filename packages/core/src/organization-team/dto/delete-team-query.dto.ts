import { IntersectionType, PickType } from "@nestjs/swagger";
import { IBasePerTenantAndOrganizationEntityModel, IRelationalEmployee } from "@gauzy/contracts";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { TenantOrganizationBaseDTO } from "../../core/dto";

/**
 * Delete team member query DTO
 */
export class DeleteTeamQueryDTO extends IntersectionType(
    PickType(TenantOrganizationBaseDTO, ['organizationId', 'tenantId']),
    PickType(EmployeeFeatureDTO, ['employeeId']),
) implements IBasePerTenantAndOrganizationEntityModel, IRelationalEmployee { }
