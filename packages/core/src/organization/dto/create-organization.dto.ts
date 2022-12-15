import { CurrenciesEnum, IOrganizationCreateInput } from "@gauzy/contracts";
import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { RelationalTagDTO } from "./../../tags/dto";
import { OrganizationBonusesDTO } from "./organization-bonuses.dto";
import { OrganizationSettingDTO } from "./organization-setting.dto";

/**
 * Organization Create DTO validation
 *
 */
export class CreateOrganizationDTO extends IntersectionType(
	OrganizationBonusesDTO,
	IntersectionType(OrganizationSettingDTO, RelationalTagDTO)
) implements IOrganizationCreateInput {

	@ApiProperty({ required: true })
	@IsNotEmpty()
	@IsString()
	readonly name: string;

	@ApiProperty({
		enum: CurrenciesEnum,
		example: CurrenciesEnum.USD,
		required: true
	})
	@IsNotEmpty()
	@IsEnum(CurrenciesEnum)
	readonly currency: CurrenciesEnum;
}