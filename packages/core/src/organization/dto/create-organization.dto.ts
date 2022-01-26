import { CurrenciesEnum, IOrganizationCreateInput } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { OrganizationBounsDTO } from "./organization-bonus.dto";

export class CreateOrganizationDTO extends OrganizationBounsDTO implements IOrganizationCreateInput {

	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsString()
	readonly name: string;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	readonly currency: CurrenciesEnum;
}