import { ApiProperty, ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { CurrenciesEnum, IOrganizationCreateInput } from '@gauzy/contracts';
import { Organization } from './../organization.entity';
import { OrganizationBonusesDTO } from './organization-bonuses.dto';
import { OrganizationSettingDTO } from './organization-setting.dto';
import { ScreenshotCaptureAcknowledgementDTO } from './screenshot-capture-acknowledgement.dto';
import { RelationalTagDTO } from './../../tags/dto';

/**
 * Organization Create DTO validation
 *
 */
export class CreateOrganizationDTO
	extends IntersectionType(
		OrganizationBonusesDTO,
		OrganizationSettingDTO,
		PickType(Organization, ['name', 'imageId', 'standardWorkHoursPerDay'] as const),
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

	/**
	 * Sent with a request that turns screen capture on (issue #9872); required for an EEA/UK organization.
	 */
	@ApiPropertyOptional({ type: () => ScreenshotCaptureAcknowledgementDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => ScreenshotCaptureAcknowledgementDTO)
	readonly screenshotCaptureAcknowledgement?: ScreenshotCaptureAcknowledgementDTO;
}
