import { ID, IOrganizationDepartmentCreateInput, ITag } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TenantOrganizationBaseDTO } from './../../core/dto';

export class CreateOrganizationDepartmentDTO
	extends TenantOrganizationBaseDTO
	implements IOrganizationDepartmentCreateInput
{
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	readonly id?: ID;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly createdAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly updatedAt?: Date;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	readonly isActive?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	readonly isArchived?: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	readonly archivedAt?: Date;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	readonly name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsArray()
	readonly tags?: ITag[];
}
