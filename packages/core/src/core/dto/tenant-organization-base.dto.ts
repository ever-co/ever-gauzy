import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, ValidateIf } from 'class-validator';
import { IOrganization, IBasePerTenantAndOrganizationEntityModel } from '@gauzy/contracts';
import { TenantBaseDTO } from './tenant-base.dto';
import { IsOrganizationShouldBelongsTo } from './../../shared/validators';

export abstract class TenantOrganizationBaseDTO extends TenantBaseDTO
	implements IBasePerTenantAndOrganizationEntityModel {

	@ApiProperty({ type: () => Object, readOnly: true })
	@ValidateIf((it) => !it.organizationId && !it.sentTo)
	@IsObject()
	@IsOrganizationShouldBelongsTo({
		message: 'This user is not belongs to the organization.'
	})
	readonly organization: IOrganization;

	@ApiProperty({ type: () => String, readOnly: true })
	@ValidateIf((it) => !it.organization && !it.sentTo)
	@IsString()
	@IsOrganizationShouldBelongsTo({
		message: 'This user is not belongs to the organization.'
	})
	readonly organizationId: IOrganization['id'];

	@ApiProperty({ type: () => String, readOnly: true })
	@ValidateIf((it) => !it.organization && !it.organizationId)
	@IsOptional()
	@IsString()
	readonly sentTo?: IOrganization['id'];
}