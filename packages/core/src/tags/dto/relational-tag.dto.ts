import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';
import { ITag } from '@gauzy/contracts';

export class RelationalTagDTO {
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	readonly tags: ITag[];
}
