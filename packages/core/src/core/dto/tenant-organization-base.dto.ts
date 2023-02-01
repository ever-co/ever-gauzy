import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
} from 'class-validator';
import {
	IOrganization,
	IBasePerTenantAndOrganizationEntityModel,
} from '@gauzy/contracts';
import { TenantBaseDTO } from './tenant-base.dto';
import { IsOrganizationBelongsToUser } from './../../shared/validators';

export class TenantOrganizationBaseDTO extends TenantBaseDTO
	implements IBasePerTenantAndOrganizationEntityModel {

	@ApiProperty({ type: () => Object })
	@ValidateIf((it) => !it.organizationId && !it.sentTo)
	@IsObject()
	@IsOrganizationBelongsToUser()
	readonly organization: IOrganization;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => !it.organization && !it.sentTo)
	@IsUUID()
	@IsOrganizationBelongsToUser()
	readonly organizationId: IOrganization['id'];

	@ApiPropertyOptional({ type: () => String })
	@ValidateIf((it) => !it.organization && !it.organizationId)
	@IsOptional()
	@IsString()
	readonly sentTo?: IOrganization['id'];
}
