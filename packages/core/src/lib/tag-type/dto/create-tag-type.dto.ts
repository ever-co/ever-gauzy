import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ITagTypeCreateInput } from '@gauzy/contracts';
import { IsString } from 'class-validator';
import { Tag, TenantOrganizationBaseDTO } from '../../core';

export class CreateTagTypeDTO extends TenantOrganizationBaseDTO implements ITagTypeCreateInput {
	@ApiProperty({ type: () => String })
	@IsString()
	readonly type: string;

	@ApiPropertyOptional({ type: () => Array, isArray: true })
	readonly tags: Tag[];
}
