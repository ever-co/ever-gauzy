import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';
import { ID, IMentionUserIds } from '@gauzy/contracts';

export class MentionUserIdsDTO implements IMentionUserIds {
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	mentionUserIds?: ID[];
}
