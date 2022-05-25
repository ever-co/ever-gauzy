import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";
import { TenantOrganizationBaseDTO } from "../../core/dto";

export class ExpenseCategoryDTO extends TenantOrganizationBaseDTO {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	readonly name: string;
}