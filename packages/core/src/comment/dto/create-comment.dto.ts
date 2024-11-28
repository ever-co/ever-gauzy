import { ApiPropertyOptional, IntersectionType, OmitType } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';
import { ICommentCreateInput, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Comment } from '../comment.entity';

/**
 * Create Comment data validation request DTO
 */
export class CreateCommentDTO
	extends IntersectionType(TenantOrganizationBaseDTO, OmitType(Comment, ['creatorId', 'creator']))
	implements ICommentCreateInput
{
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	mentionIds?: ID[];
}
