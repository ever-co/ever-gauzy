import { IExpenseCategory, IExpenseCreateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";
import { RelationalTagDTO } from "./../../tags/dto";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { OrganizationVendorFeatureDTO } from "./../../organization-vendor/dto";
import { ExpenseDTO } from "./expense.dto";

/**
 * Create Expense DTO request validation
 */
export class CreateExpenseDTO extends IntersectionType(
    ExpenseDTO,
    OrganizationVendorFeatureDTO,
    PartialType(EmployeeFeatureDTO),
    RelationalTagDTO
) implements IExpenseCreateInput {

    @ApiProperty({ type: () => Object, readOnly: true })
    @IsOptional()
    @IsObject()
    readonly category: IExpenseCategory;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly categoryId: string;
}