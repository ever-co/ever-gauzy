import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { IsExpenseCategoryAlreadyExist } from "./../../shared/validators";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class ExpenseCategoryDTO extends TenantOrganizationBaseDTO {

	@ApiProperty({ type: () => String, readOnly: true })
	@IsNotEmpty()
	@IsExpenseCategoryAlreadyExist()
	readonly name: string;
}