import { IEmployeeAwardCreateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { IsNotEmpty } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";
import { EmployeeFeatureDTO } from "./../../employee/dto";

/**
 * Create employee award DTO validation
 */
export class CreateEmployeeAwardDTO extends IntersectionType(
    TenantOrganizationBaseDTO,
    EmployeeFeatureDTO
) implements IEmployeeAwardCreateInput {

	@IsNotEmpty()
	readonly name: string;

	@IsNotEmpty()
	readonly year: string;
}