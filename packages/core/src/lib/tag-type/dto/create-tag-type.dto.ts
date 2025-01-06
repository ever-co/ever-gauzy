import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Tag } from '../../core';
import { ITagTypeCreateInput } from '@gauzy/contracts';

export class CreateTagTypeDTO implements ITagTypeCreateInput {
	@ApiProperty({ type: () => String })
	@IsString()
	readonly type: string;

	@ApiPropertyOptional({ type: () => Array, isArray: true })
	readonly tags: Tag[];
}
