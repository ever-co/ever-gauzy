import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { CurrenciesEnum, IOrganizationCreateInput } from '@gauzy/contracts';
import { Organization } from './../organization.entity';
import { OrganizationBonusesDTO } from './organization-bonuses.dto';
import { OrganizationSettingDTO } from './organization-setting.dto';
import { RelationalTagDTO } from './../../tags/dto';

/**
 * Organization Create DTO validation
 *
 */
export class CreateOrganizationDTO
	extends IntersectionType(
		OrganizationBonusesDTO,
		OrganizationSettingDTO,
		PickType(Organization, ['name', 'imageId', 'standardWorkHoursPerDay', 'emailDomain'] as const),
		PickType(Organization, ['upworkOrganizationId', 'upworkOrganizationName'] as const),
		RelationalTagDTO
	)
	implements IOrganizationCreateInput
{
	@ApiProperty({
		enum: CurrenciesEnum,
		example: CurrenciesEnum.USD,
		required: true
	})
	@IsNotEmpty()
	@IsEnum(CurrenciesEnum)
	readonly currency: CurrenciesEnum;
}
