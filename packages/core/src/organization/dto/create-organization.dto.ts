import { CurrenciesEnum, IOrganizationCreateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { RelationalTagDTO } from "tags/dto";
import { OrganizationBounsDTO } from "./organization-bonus.dto";
import { OrganizationSettingDTO } from "./organization-setting.dto";

/**
 * Organization Create DTO
 * 
 */
export class CreateOrganizationDTO extends IntersectionType(
	OrganizationBounsDTO,
	OrganizationSettingDTO,
	RelationalTagDTO
) implements IOrganizationCreateInput {

	@ApiProperty({ type: () => String, required: true, readOnly: true })
	@IsNotEmpty()
	@IsString()
	readonly name: string;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum, readOnly: true })
	@IsEnum(CurrenciesEnum)
	readonly currency: CurrenciesEnum;
}