import { IExpenseCategory } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { RelationalTagDTO } from "./../../tags/dto";
import { ExpenseCategoryDTO } from "./expense-category.dto";

/**
 * Update expense category request validation
 */
export class UpdateExpenseCategoryDTO extends IntersectionType(
    ExpenseCategoryDTO,
    RelationalTagDTO
) implements IExpenseCategory {

    @ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly id: string;
}