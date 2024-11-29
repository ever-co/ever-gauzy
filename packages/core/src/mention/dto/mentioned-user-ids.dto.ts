import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';
import { ID, IMentionedUserIds } from '@gauzy/contracts';

export class MentionedUserIdsDTO implements IMentionedUserIds {
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	mentionIds?: ID[];
}
