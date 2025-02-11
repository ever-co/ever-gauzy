import { ApiPropertyOptional, IntersectionType, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ICommentCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { MentionUserIdsDTO } from '../../mention/dto';
import { Comment } from '../comment.entity';

/**
 * Create Comment data validation request DTO
 */
export class CreateCommentDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		IntersectionType(OmitType(Comment, ['creatorId', 'creator']), MentionUserIdsDTO)
	)
	implements ICommentCreateInput
{
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	entityName?: string;
}
