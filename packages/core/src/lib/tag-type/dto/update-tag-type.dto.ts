import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ITagTypeUpdateInput } from '@gauzy/contracts';
import { Tag, TenantOrganizationBaseDTO } from '../../core';

export class UpdateTagTypeDTO extends TenantOrganizationBaseDTO implements ITagTypeUpdateInput {
	@ApiProperty({ type: () => String })
	@IsString()
	readonly type: string;

	@ApiPropertyOptional({ type: () => Array, isArray: true })
	readonly tags: Tag[];
}
