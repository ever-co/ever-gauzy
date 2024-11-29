import { IntersectionType, OmitType } from '@nestjs/swagger';
import { ICommentCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { MentionedUserIdsDTO } from '../../mention/dto';
import { Comment } from '../comment.entity';

/**
 * Create Comment data validation request DTO
 */
export class CreateCommentDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		IntersectionType(OmitType(Comment, ['creatorId', 'creator']), MentionedUserIdsDTO)
	)
	implements ICommentCreateInput {}
