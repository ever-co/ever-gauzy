import { IntersectionType, PickType } from "@nestjs/swagger";
import { IBasePerTenantAndOrganizationEntityModel, IRelationalEmployee } from "@gauzy/contracts";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { DeleteQueryDTO } from "./../../shared/dto";

/**
 * Delete team member query DTO
 */
export class DeleteTeamMemberQueryDTO extends IntersectionType(
    DeleteQueryDTO,
    PickType(EmployeeFeatureDTO, ['employeeId']),
) implements IBasePerTenantAndOrganizationEntityModel, IRelationalEmployee { }
