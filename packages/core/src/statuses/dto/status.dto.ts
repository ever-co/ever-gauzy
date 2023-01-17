import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IOrganizationProject, IStatus } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';

export class StatusDTO extends PartialType(TenantOrganizationBaseDTO)
	implements IStatus {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	name: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	value: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	icon?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	color?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	projectId?: IOrganizationProject['id'];
}
